'use strict';
const crypto = require('node:crypto');
const MoneyLock = require('../models/MoneyLock');
const Receipt = require('../models/IdempotencyReceipt');
const Wallet = require('../models/Wallet');
const Jar = require('../models/Jar');
const Installment = require('../models/Installment');
const { runWithTransaction } = require('./mongoTransaction');
const { getAllWalletBalances } = require('./walletBalance');
const { isFiniteInteger } = require('./money');

class Rejected extends Error {
    constructor(status, body) { super('Financial request rejected.'); this.status = status; this.body = body; }
}
function reject(message, status = 400) { throw new Rejected(status, { success: false, message }); }
function canonical(value, depth = 0) {
    if (depth > 32) reject('Dữ liệu yêu cầu có quá nhiều lớp lồng nhau.');
    if (Array.isArray(value)) return '[' + value.map(item => canonical(item, depth + 1)).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
        .map(key => JSON.stringify(key) + ':' + canonical(value[key], depth + 1)).join(',') + '}';
    return JSON.stringify(value);
}
async function validateInput(req) {
    const body = req.body || {};
    for (const key of ['nextDueDate', 'targetDate']) {
        const value = body[key];
        if (value === undefined || value === null || value === '') continue;
        const parsed = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + 'T00:00:00.000Z');
        if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) reject('Ngày không hợp lệ.');
    }
    for (const key of ['amount', 'fee', 'initialBalance', 'creditLimit', 'target', 'current']) {
        if (body[key] !== undefined && (!isFiniteInteger(body[key]) ||
            (key !== 'initialBalance' && body[key] < 0))) reject('Số tiền phải là số nguyên VNĐ trong miền chính xác.');
    }
    for (const [key, Model] of Object.entries({ walletId: Wallet, toWalletId: Wallet,
        transferToWalletId: Wallet, replacementWalletId: Wallet, jarId: Jar, installmentId: Installment })) {
        const value = body[key];
        if (value === undefined || value === null || value === '') continue;
        if (key === 'walletId' && value === 'w_default_cash' && req.baseUrl === '/api/spending') continue;
        if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) reject('ID liên kết không hợp lệ.');
        const filter = { _id: value, userId: req.user.id };
        if (Model === Wallet) filter.archived = false;
        if (!await Model.exists(filter)) reject('Dữ liệu liên kết không tồn tại hoặc không thuộc tài khoản.');
    }
    if (req.baseUrl.toLowerCase() === '/api/spending' && (body.jarId || body.installmentId)) {
        reject('Giao dịch hũ/khoản định kỳ phải được tạo từ API chuyên biệt.');
    }
    if (/\/(?:deposit|withdraw)$/.test(req.path) && !body.walletId) reject('Cần chọn ví liên kết khi nạp/rút hũ.');
}
async function verifyBalances(userId) {
    const balances = await getAllWalletBalances(userId);
    const wallets = await Wallet.find({ userId }).lean();
    for (const wallet of wallets) {
        const balance = balances[wallet._id.toString()];
        if (!Number.isSafeInteger(balance)) reject('Số dư vượt miền số nguyên chính xác.', 409);
        if (wallet.archived && balance !== 0) reject('Không thể thay đổi số dư của ví đã đóng.', 409);
        const minimum = wallet.type === 'credit' ? -(wallet.creditLimit || 0) : 0;
        if (balance < minimum) reject('Số dư ví không đủ hoặc vượt hạn mức tín dụng.', 409);
    }
    let total = Object.values(balances).reduce((sum, value) => sum + BigInt(value), 0n);
    for (const jar of await Jar.find({ userId }).select('current target').lean()) {
        if (!Number.isSafeInteger(jar.current) || jar.current < 0 || !Number.isSafeInteger(jar.target)) {
            reject('Số dư hũ không hợp lệ.', 409);
        }
        total += BigInt(jar.current);
    }
    if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER)) {
        reject('Tổng tài sản vượt miền số nguyên chính xác.', 409);
    }
    for (const item of await Installment.find({ userId }).select('amount totalPaid').lean()) {
        if (!Number.isSafeInteger(item.amount) || !Number.isSafeInteger(item.totalPaid)) reject('Tổng tiền định kỳ vượt miền chính xác.', 409);
    }
}
function financialRequest(handler) {
    return async function transactionHandler(req, res, next) {
        const write = !['GET', 'HEAD'].includes(req.method);
        const key = req.get('Idempotency-Key');
        if (write && (typeof key !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key))) {
            return res.status(400).json({ success: false, message: 'Cần Idempotency-Key dạng UUID cho thao tác ghi.' });
        }
        try {
            const fingerprint = crypto.createHash('sha256').update(canonical({
                method: req.method, path: req.baseUrl.toLowerCase() + req.path,
                query: req.query, body: req.body || {}
            })).digest('hex');
            // Bootstrap only the serialization fence outside the money transaction.
            try { await MoneyLock.updateOne({ _id: req.user.id }, { $setOnInsert: { token: crypto.randomUUID() } }, { upsert: true }); }
            catch (error) { if (error.code !== 11000) throw error; }
            const response = await runWithTransaction(async () => {
                // All wallet/jar/ledger routes acquire the same fence before reading.
                // A random token always writes, even after arbitrarily many requests.
                // A numeric revision could eventually round to an unchanged value.
                await MoneyLock.updateOne({ _id: req.user.id }, { $set: { token: crypto.randomUUID() } });
                if (write) {
                    const saved = await Receipt.findOne({ userId: req.user.id, key }).lean();
                    if (saved) {
                        if (saved.fingerprint !== fingerprint) reject('Idempotency-Key đã dùng với nội dung khác.', 409);
                        return { status: saved.status, body: saved.body };
                    }
                }
                await validateInput(req);
                let result;
                const reply = {
                    statusCode: 200,
                    status(code) { this.statusCode = code; return this; },
                    json(body) { result = { status: this.statusCode, body }; return this; }
                };
                await handler(req, reply, error => { throw error || new Error('Unexpected handler fallthrough.'); });
                if (!result) throw new Error('Missing financial response.');
                if (result.status >= 400) throw new Rejected(result.status, result.body);
                if (write) {
                    await verifyBalances(req.user.id);
                    await Receipt.create({ userId: req.user.id, key, fingerprint, ...result });
                }
                return result;
            });
            return res.status(response.status).json(response.body);
        } catch (error) {
            if (error instanceof Rejected) return res.status(error.status).json(error.body);
            console.error('[finance] transaction_failed');
            return res.status(503).json({ success: false, code: 'TRANSACTION_FAILED',
                message: 'Giao dịch chưa được xác nhận. Hãy thử lại với cùng mã yêu cầu.' });
        }
    };
}
module.exports = { financialRequest };
