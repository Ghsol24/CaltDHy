'use strict';

const mongoose = require('mongoose');
const ExchangeRate = require('../models/ExchangeRate');

// Tỷ giá USD→VND tham chiếu, chỉ để hiển thị. Không bao giờ đi vào dữ liệu tài chính.
//
// Nguồn: ExchangeRate-API, gói mở (https://www.exchangerate-api.com/docs/free), không cần API key,
// cập nhật mỗi ngày một lần. Điều khoản của gói mở yêu cầu ghi nguồn, nên phản hồi luôn kèm tên
// và liên kết nhà cung cấp.
//
// Cấu hình (tùy chọn, mặc định không cần đặt gì):
//   FX_AUTO_REFRESH=false     không gọi ra ngoài; chỉ phục vụ bản đã lưu (hoặc 503 nếu chưa có).
//   FX_VND_PER_USD, FX_SOURCE, FX_AS_OF
//                             đặt đủ cả ba để ghi đè bằng một tỷ giá cố định; khi đó không gọi nguồn.
const PROVIDER_URL = 'https://open.er-api.com/v6/latest/USD';
const PROVIDER_NAME = 'ExchangeRate-API';
const PROVIDER_SITE = 'https://www.exchangerate-api.com';
const PAIR = 'USD_VND';
const HOUR_MS = 60 * 60 * 1000;
const REFRESH_MS = 24 * HOUR_MS;   // tối đa một lần gọi nguồn mỗi ngày khi mọi thứ ổn
const RETRY_MS = HOUR_MS;          // nguồn lỗi thì chờ một giờ mới thử lại
const TIMEOUT_MS = 5000;
const MAX_BODY_CHARS = 200000;
const MIN_RATE = 1000;
const MAX_RATE = 1000000;

let latest = null;          // { vndPerUsd, source, sourceUrl, asOf: Date, fetchedAt: Date }
let lastAttemptAt = 0;
let inflight = null;

const validRate = value => typeof value === 'number' && Number.isFinite(value) &&
    value >= MIN_RATE && value <= MAX_RATE;
const dbReady = () => mongoose.connection.readyState === 1;

function isoTimestamp(value) {
    if (typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return null;
    const date = new Date(value.length === 10 ? value + 'T00:00:00.000Z' : value);
    if (Number.isNaN(date.getTime())) return null;
    if (value.length === 10 && date.toISOString().slice(0, 10) !== value) return null;
    return date;
}

/** A fixed rate from the environment, or null. All three values must be present and valid. */
function fixedOverride() {
    const { FX_VND_PER_USD: rateText, FX_SOURCE: sourceText, FX_AS_OF: asOfText } = process.env;
    if (!rateText && !sourceText && !asOfText) return null;
    const rate = Number(rateText);
    const source = String(sourceText || '').trim();
    const asOf = isoTimestamp(String(asOfText || '').trim());
    if (!validRate(rate) || !source || source.length > 80 || !asOf) return null;
    return { vndPerUsd: rate, source, sourceUrl: '', asOf, fetchedAt: asOf };
}

/** Validates an open.er-api.com response. Returns a snapshot or null for anything unexpected. */
function parseProviderPayload(body, now = Date.now()) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    if (body.result !== 'success' || body.base_code !== 'USD') return null;
    const rates = body.rates;
    if (!rates || typeof rates !== 'object') return null;
    const rate = rates.VND;
    if (!validRate(rate)) return null;
    const unix = body.time_last_update_unix;
    if (!Number.isSafeInteger(unix) || unix <= 0) return null;
    const asOf = new Date(unix * 1000);
    // Một thời điểm công bố ở tương lai là dữ liệu hỏng.
    if (asOf.getTime() > now + HOUR_MS) return null;
    return {
        vndPerUsd: Math.round(rate * 100) / 100,
        source: PROVIDER_NAME,
        sourceUrl: PROVIDER_SITE,
        asOf
    };
}

async function fetchFromProvider(fetchImpl, now) {
    if (typeof fetchImpl !== 'function') throw new Error('fetch unavailable');
    const response = await fetchImpl(PROVIDER_URL, {
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!response || !response.ok) throw new Error('provider status');
    const text = await response.text();
    if (typeof text !== 'string' || text.length > MAX_BODY_CHARS) throw new Error('provider body');
    const snapshot = parseProviderPayload(JSON.parse(text), now);
    if (!snapshot) throw new Error('provider payload');
    return snapshot;
}

function fromDocument(doc) {
    if (!doc || !validRate(doc.vndPerUsd) || typeof doc.source !== 'string' || !doc.source ||
        !(doc.asOf instanceof Date) || Number.isNaN(doc.asOf.getTime()) ||
        !(doc.fetchedAt instanceof Date) || Number.isNaN(doc.fetchedAt.getTime())) return null;
    return {
        vndPerUsd: doc.vndPerUsd, source: doc.source, sourceUrl: doc.sourceUrl || '',
        asOf: doc.asOf, fetchedAt: doc.fetchedAt
    };
}

async function readStored() {
    if (!dbReady()) return null;
    try {
        return fromDocument(await ExchangeRate.findOne({ pair: PAIR }).lean());
    } catch {
        console.error('[fx] read_failed');
        return null;
    }
}

async function store(snapshot) {
    if (!dbReady()) return;
    try {
        await ExchangeRate.updateOne({ pair: PAIR }, { $set: { pair: PAIR, ...snapshot } },
            { upsert: true, runValidators: true });
    } catch {
        console.error('[fx] store_failed');
    }
}

// Bằng nhau thì giữ bản đang có trong bộ nhớ, để mọi request nhận cùng một object.
const newer = (a, b) => (!a ? b : !b ? a : (b.fetchedAt > a.fetchedAt ? b : a));
const isFresh = (snapshot, now) => Boolean(snapshot) && now - snapshot.fetchedAt.getTime() < REFRESH_MS;

async function refresh(fetchImpl, now) {
    lastAttemptAt = now;
    try {
        const snapshot = { ...(await fetchFromProvider(fetchImpl, now)), fetchedAt: new Date(now) };
        latest = snapshot;
        await store(snapshot);
    } catch {
        // Không ghi lỗi, URL hay nội dung phản hồi; bản gần nhất (nếu có) tiếp tục được dùng.
        console.error('[fx] refresh_failed');
    }
    return latest;
}

/**
 * The latest USD→VND snapshot, refreshed lazily at most once a day. When the provider fails the
 * last known snapshot is returned; null only when there has never been one.
 */
async function getUsdRate({ now = Date.now(), fetchImpl = globalThis.fetch } = {}) {
    const fixed = fixedOverride();
    if (fixed) return fixed;
    if (isFresh(latest, now)) return latest;
    // Một instance khác (hoặc lần chạy trước) có thể đã làm mới và lưu vào Mongo. Đọc `latest`
    // SAU khi chờ Mongo: trong lúc chờ, một request khác có thể đã lấy bản mới từ nguồn.
    const stored = await readStored();
    latest = newer(latest, stored);
    if (isFresh(latest, now) || process.env.FX_AUTO_REFRESH === 'false') return latest;
    if (inflight) return inflight;
    if (now - lastAttemptAt < RETRY_MS) return latest;
    inflight = refresh(fetchImpl, now).finally(() => { inflight = null; });
    return inflight;
}

function toPublic(snapshot) {
    return {
        vndPerUsd: snapshot.vndPerUsd,
        source: snapshot.source,
        sourceUrl: snapshot.sourceUrl || '',
        asOf: snapshot.asOf.toISOString()
    };
}

function resetExchangeRateCache() {
    latest = null;
    lastAttemptAt = 0;
    inflight = null;
}

module.exports = {
    getUsdRate, toPublic, parseProviderPayload, resetExchangeRateCache,
    PROVIDER_URL, PROVIDER_NAME, PROVIDER_SITE, REFRESH_MS, RETRY_MS, TIMEOUT_MS
};
