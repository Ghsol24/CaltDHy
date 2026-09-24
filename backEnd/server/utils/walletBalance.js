'use strict';
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
function integer(value) {
    if (!Number.isSafeInteger(value)) throw new Error('Invalid stored money value.');
    return BigInt(value);
}
async function getAllWalletBalances(userId) {
    const wallets = await Wallet.find({ userId }).select('_id initialBalance').lean();
    const balances = new Map(wallets.map(wallet => [wallet._id.toString(), integer(wallet.initialBalance)]));
    const rows = await Transaction.find({ userId }).select('type amount fee walletId toWalletId').lean();
    function add(id, change) {
        if (!id) return;
        const key = id.toString();
        if (!balances.has(key)) throw new Error('Ledger references a missing wallet.');
        balances.set(key, balances.get(key) + change);
    }
    for (const row of rows) {
        const amount = integer(row.amount);
        const fee = integer(row.fee || 0);
        if (row.type === 'income') add(row.walletId, amount);
        else if (row.type === 'expense') add(row.walletId, -amount - fee);
        else if (row.type === 'transfer') {
            add(row.walletId, -amount - fee);
            add(row.toWalletId, amount);
        }
    }
    const result = {};
    let total = 0n;
    for (const [id, value] of balances) {
        if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
            throw new Error('Balance exceeds safe integer range.');
        }
        result[id] = Number(value);
        total += value;
    }
    if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER)) {
        throw new Error('Total exceeds safe integer range.');
    }
    return result;
}
async function getWalletBalance(userId, walletId) {
    const balances = await getAllWalletBalances(userId);
    const value = balances[String(walletId)];
    if (value === undefined) throw new Error('Wallet not found.');
    return value;
}
module.exports = { getWalletBalance, getAllWalletBalances };
