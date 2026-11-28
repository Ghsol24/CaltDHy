'use strict';
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.API_RATE_LIMIT_MAX = '100000';
for (const name of ['MONGODB_URI', 'CORS_WHITELIST', 'CLIENT_URL', 'FX_AUTO_REFRESH', 'FX_VND_PER_USD', 'FX_SOURCE', 'FX_AS_OF']) delete process.env[name];
const request = require('supertest');
const app = require('../server');
const ExchangeRate = require('../models/ExchangeRate');
const {
    getUsdRate, parseProviderPayload, resetExchangeRateCache, PROVIDER_URL, REFRESH_MS, RETRY_MS
} = require('../utils/exchangeRate');

const now = Date.parse('2026-11-28T03:00:00.000Z');
const published = Math.floor(Date.parse('2026-11-28T00:02:31.000Z') / 1000);
const payload = (extra = {}) => ({
    result: 'success', base_code: 'USD', time_last_update_unix: published,
    rates: { USD: 1, VND: 26315.123, EUR: 0.86 }, ...extra
});
// A fetch stand-in that records every call and answers from a queue of responders.
function fakeFetch(...responders) {
    const calls = [];
    const fn = async (url, options) => {
        calls.push({ url, options });
        const next = responders.length > 1 ? responders.shift() : responders[0];
        return next(url, options);
    };
    fn.calls = calls;
    return fn;
}
const ok = body => async () => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
const status = code => async () => ({ ok: false, status: code, text: async () => '{}' });
const fails = async () => { throw new TypeError('fetch failed'); };
const raw = text => async () => ({ ok: true, status: 200, text: async () => text });
const quietly = async run => {
    const original = console.error;
    console.error = () => {};
    try { return await run(); } finally { console.error = original; }
};

describe('USD reference rate', { concurrency: false }, () => {
    let db;
    before(async () => {
        db = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
        await mongoose.connect(db.getUri('caltdhy_fx_test'));
        await ExchangeRate.createCollection();
        await ExchangeRate.createIndexes();
    });
    after(async () => { await mongoose.disconnect(); if (db) await db.stop(); });
    beforeEach(async () => {
        resetExchangeRateCache();
        await ExchangeRate.deleteMany({});
    });

    it('fetches the provider, validates it and stores the snapshot', async () => {
        const fetchImpl = fakeFetch(ok(payload()));
        const rate = await getUsdRate({ now, fetchImpl });
        assert.equal(fetchImpl.calls.length, 1);
        assert.equal(fetchImpl.calls[0].url, PROVIDER_URL);
        assert.ok(fetchImpl.calls[0].options.signal instanceof AbortSignal, 'the request has a timeout');
        assert.equal(rate.vndPerUsd, 26315.12);
        assert.equal(rate.source, 'ExchangeRate-API');
        assert.equal(rate.asOf.toISOString(), '2026-11-28T00:02:31.000Z');
        const stored = await ExchangeRate.findOne({ pair: 'USD_VND' }).lean();
        assert.equal(stored.vndPerUsd, 26315.12);
        assert.equal(stored.fetchedAt.getTime(), now);
    });

    it('asks the provider at most once a day, also across restarts', async () => {
        const fetchImpl = fakeFetch(ok(payload()));
        await getUsdRate({ now, fetchImpl });
        await getUsdRate({ now: now + 60_000, fetchImpl });
        await Promise.all([1, 2, 3].map(() => getUsdRate({ now: now + 120_000, fetchImpl })));
        assert.equal(fetchImpl.calls.length, 1, 'memory cache');
        resetExchangeRateCache();
        const rate = await getUsdRate({ now: now + REFRESH_MS - 1, fetchImpl });
        assert.equal(fetchImpl.calls.length, 1, 'Mongo copy is reused after a restart');
        assert.equal(rate.vndPerUsd, 26315.12);
        const next = payload({ time_last_update_unix: published + 86400, rates: { VND: 26400 } });
        const later = fakeFetch(ok(next));
        const refreshed = await getUsdRate({ now: now + REFRESH_MS, fetchImpl: later });
        assert.equal(later.calls.length, 1, 'refreshed after a day');
        assert.equal(refreshed.vndPerUsd, 26400);
    });

    it('concurrent requests share one provider call', async () => {
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        const fetchImpl = fakeFetch(async () => { await gate; return ok(payload())(); });
        const pending = Promise.all([getUsdRate({ now, fetchImpl }), getUsdRate({ now, fetchImpl })]);
        await new Promise(resolve => setImmediate(resolve));
        release();
        const [a, b] = await pending;
        assert.equal(fetchImpl.calls.length, 1);
        assert.equal(a, b);
    });

    it('a late Mongo read never replaces the snapshot another request just fetched', async () => {
        // Many callers race: one fetches and stores while the others are still reading Mongo.
        for (let round = 0; round < 25; round += 1) {
            resetExchangeRateCache();
            await ExchangeRate.deleteMany({});
            const fetchImpl = fakeFetch(ok(payload()));
            const results = await Promise.all(Array.from({ length: 8 }, () => getUsdRate({ now, fetchImpl })));
            assert.equal(fetchImpl.calls.length, 1, 'round ' + round);
            for (const result of results) assert.equal(result, results[0], 'round ' + round);
            assert.equal(await getUsdRate({ now, fetchImpl }), results[0], 'round ' + round);
        }
    });

    it('keeps the last known rate when the provider fails, and backs off', async () => {
        await getUsdRate({ now, fetchImpl: fakeFetch(ok(payload())) });
        const stale = now + REFRESH_MS + 1;
        for (const responder of [fails, status(500), raw('<html>busy</html>')]) {
            resetExchangeRateCache();
            const fetchImpl = fakeFetch(responder);
            const rate = await quietly(() => getUsdRate({ now: stale, fetchImpl }));
            assert.equal(fetchImpl.calls.length, 1);
            assert.equal(rate.vndPerUsd, 26315.12, 'last known good');
            await getUsdRate({ now: stale + RETRY_MS - 1, fetchImpl });
            assert.equal(fetchImpl.calls.length, 1, 'no retry storm while the provider is down');
        }
    });

    it('returns nothing when the provider fails and nothing is stored', async () => {
        const rate = await quietly(() => getUsdRate({ now, fetchImpl: fakeFetch(fails) }));
        assert.equal(rate, null);
        assert.equal(await ExchangeRate.countDocuments(), 0);
    });

    it('rejects garbage and implausible payloads', () => {
        assert.ok(parseProviderPayload(payload(), now));
        for (const body of [
            null, [], 'success', {},
            payload({ result: 'error' }),
            payload({ base_code: 'EUR' }),
            payload({ rates: {} }),
            payload({ rates: { VND: '26000' } }),
            payload({ rates: { VND: 0 } }),
            payload({ rates: { VND: -26000 } }),
            payload({ rates: { VND: 26 } }),
            payload({ rates: { VND: 26_000_000 } }),
            payload({ rates: { VND: Number.NaN } }),
            payload({ time_last_update_unix: 'yesterday' }),
            payload({ time_last_update_unix: 0 }),
            payload({ time_last_update_unix: Math.floor(now / 1000) + 2 * 3600 })
        ]) assert.equal(parseProviderPayload(body, now), null, JSON.stringify(body));
    });

    it('stores nothing from a garbage response', async () => {
        const rate = await quietly(() => getUsdRate({ now, fetchImpl: fakeFetch(ok(payload({ rates: { VND: 'lots' } }))) }));
        assert.equal(rate, null);
        assert.equal(await ExchangeRate.countDocuments(), 0);
    });

    it('can be switched off or overridden from the environment', async () => {
        const fetchImpl = fakeFetch(ok(payload()));
        process.env.FX_AUTO_REFRESH = 'false';
        try {
            assert.equal(await getUsdRate({ now, fetchImpl }), null);
            assert.equal(fetchImpl.calls.length, 0);
        } finally { delete process.env.FX_AUTO_REFRESH; }
        Object.assign(process.env, { FX_VND_PER_USD: '25000', FX_SOURCE: 'Manual', FX_AS_OF: '2026-11-27' });
        try {
            const rate = await getUsdRate({ now, fetchImpl });
            assert.equal(rate.vndPerUsd, 25000);
            assert.equal(rate.source, 'Manual');
            assert.equal(fetchImpl.calls.length, 0);
            process.env.FX_SOURCE = '';
            resetExchangeRateCache();
            await getUsdRate({ now, fetchImpl });
            assert.equal(fetchImpl.calls.length, 1, 'an incomplete override is ignored');
        } finally {
            for (const name of ['FX_VND_PER_USD', 'FX_SOURCE', 'FX_AS_OF']) delete process.env[name];
        }
    });

    it('GET /api/fx/usd serves the snapshot, or 503 when there is none', async () => {
        const original = globalThis.fetch;
        try {
            globalThis.fetch = fakeFetch(fails);
            const missing = await quietly(() => request(app).get('/api/fx/usd').set('Accept-Language', 'en'));
            assert.equal(missing.status, 503);
            assert.equal(missing.body.success, false);
            assert.equal(missing.body.code, 'FX_UNAVAILABLE');
            assert.match(missing.body.message, /exchange rate/i);

            resetExchangeRateCache();
            globalThis.fetch = fakeFetch(ok(payload({ time_last_update_unix: Math.floor(Date.now() / 1000) - 3600 })));
            const response = await request(app).get('/api/fx/usd');
            assert.equal(response.status, 200);
            assert.equal(response.headers['cache-control'], 'no-store');
            assert.deepEqual(Object.keys(response.body).sort(), ['asOf', 'source', 'sourceUrl', 'success', 'vndPerUsd']);
            assert.equal(response.body.vndPerUsd, 26315.12);
            assert.equal(response.body.source, 'ExchangeRate-API');
            assert.equal(response.body.sourceUrl, 'https://www.exchangerate-api.com');
            assert.ok(!Number.isNaN(Date.parse(response.body.asOf)));
        } finally {
            globalThis.fetch = original;
        }
    });
});
