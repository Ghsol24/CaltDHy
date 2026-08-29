const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

/**
 * Tính số dư hiện tại của một ví cụ thể on-the-fly.
 * Công thức: balance = initialBalance + Σ(income) - Σ(expense + fee) - Σ(transfer out + fee) + Σ(transfer in)
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string|mongoose.Types.ObjectId} walletId
 * @returns {Promise<number>} Số dư của ví (trả về 0 nếu ví không tồn tại)
 */
async function getWalletBalance(userId, walletId) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const walletObjectId = new mongoose.Types.ObjectId(walletId);

    const wallet = await Wallet.findOne({ _id: walletObjectId, userId: userObjectId });
    if (!wallet) return 0;

    const result = await Transaction.aggregate([
        {
            $match: {
                userId: userObjectId,
                $or: [
                    { walletId: walletObjectId },
                    { toWalletId: walletObjectId, type: 'transfer' }
                ]
            }
        },
        {
            $group: {
                _id: null,
                totalChange: {
                    $sum: {
                        $cond: [
                            { $eq: ['$walletId', walletObjectId] },
                            {
                                $switch: {
                                    branches: [
                                        { case: { $eq: ['$type', 'income'] }, then: '$amount' },
                                        { case: { $eq: ['$type', 'expense'] }, then: { $multiply: [{ $add: ['$amount', { $ifNull: ['$fee', 0] }] }, -1] } },
                                        { case: { $eq: ['$type', 'transfer'] }, then: { $multiply: [{ $add: ['$amount', { $ifNull: ['$fee', 0] }] }, -1] } }
                                    ],
                                    default: 0
                                }
                            },
                            // Trường hợp toWalletId nhận transfer
                            '$amount'
                        ]
                    }
                }
            }
        }
    ]);

    const netChange = result.length > 0 ? result[0].totalChange : 0;
    return (Number(wallet.initialBalance) || 0) + netChange;
}

/**
 * Tính số dư của toàn bộ ví của một user bằng một pipeline Transaction.aggregate duy nhất.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<Object.<string, number>>} Object map { [walletId]: balance }
 */
async function getAllWalletBalances(userId) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1. Lấy tất cả các ví của user để có initialBalance
    const wallets = await Wallet.find({ userId: userObjectId, archived: false }).select('_id initialBalance');
    const balanceMap = {};
    for (const w of wallets) {
        balanceMap[w._id.toString()] = Number(w.initialBalance) || 0;
    }

    // 2. Chạy một aggregation pipeline duy nhất trên Transaction gom dòng tiền theo từng ví
    const netChanges = await Transaction.aggregate([
        { $match: { userId: userObjectId } },
        {
            $project: {
                flows: [
                    // Luồng 1: Tác động lên walletId (ví nguồn / ví chi / ví nhận income)
                    {
                        walletId: '$walletId',
                        change: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ['$type', 'income'] }, then: '$amount' },
                                    { case: { $eq: ['$type', 'expense'] }, then: { $multiply: [{ $add: ['$amount', { $ifNull: ['$fee', 0] }] }, -1] } },
                                    { case: { $eq: ['$type', 'transfer'] }, then: { $multiply: [{ $add: ['$amount', { $ifNull: ['$fee', 0] }] }, -1] } }
                                ],
                                default: 0
                            }
                        }
                    },
                    // Luồng 2: Tác động lên toWalletId (ví đích nhận tiền chuyển đến)
                    {
                        walletId: {
                            $cond: [
                                { $eq: ['$type', 'transfer'] },
                                '$toWalletId',
                                null
                            ]
                        },
                        change: {
                            $cond: [
                                { $eq: ['$type', 'transfer'] },
                                '$amount',
                                0
                            ]
                        }
                    }
                ]
            }
        },
        { $unwind: '$flows' },
        { $match: { 'flows.walletId': { $ne: null } } },
        {
            $group: {
                _id: '$flows.walletId',
                totalChange: { $sum: '$flows.change' }
            }
        }
    ]);

    // 3. Kết hợp biến động từ giao dịch vào initialBalance của từng ví
    for (const item of netChanges) {
        if (!item._id) continue;
        const wid = item._id.toString();
        if (balanceMap[wid] !== undefined) {
            balanceMap[wid] += item.totalChange;
        } else {
            balanceMap[wid] = item.totalChange;
        }
    }

    return balanceMap;
}

module.exports = {
    getWalletBalance,
    getAllWalletBalances
};
