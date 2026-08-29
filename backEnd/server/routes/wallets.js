const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { runWithTransaction } = require('../utils/mongoTransaction');
const { getWalletBalance, getAllWalletBalances } = require('../utils/walletBalance');
const { isValidVNDAmount, isFiniteInteger } = require('../utils/money');

// Tất cả routes wallets đều cần xác thực JWT
router.use(protect);

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Helper: Tự động khởi tạo ví mặc định "Tiền mặt" nếu user chưa có ví nào
 */
async function ensureDefaultWallet(userId) {
    let count = await Wallet.countDocuments({ userId, archived: false });
    if (count === 0) {
        const defaultWallet = await Wallet.create({
            userId,
            name: 'Tiền mặt',
            type: 'cash',
            icon: '💵',
            color: '#2ed573',
            initialBalance: 0,
            isDefault: true,
            isExcludedFromTotal: false
        });
        return [defaultWallet];
    }
    return null;
}

// =============================================
// GET /api/wallets — Lấy danh sách ví của user
// =============================================
router.get('/', async (req, res) => {
    try {
        await ensureDefaultWallet(req.user.id);
        const wallets = await Wallet.find({ userId: req.user.id, archived: false }).sort({ isDefault: -1, createdAt: 1 });
        res.json({
            success: true,
            data: wallets.map(w => w.toJSON())
        });
    } catch (error) {
        console.error('GET /api/wallets error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách ví.' });
    }
});

// =============================================
// GET /api/wallets/balances — Lấy số dư thực tế tính on-the-fly của các ví
// Hỗ trợ query ?walletId=<id> để lấy 1 ví hoặc không truyền để lấy tất cả
// =============================================
router.get('/balances', async (req, res) => {
    try {
        const { walletId } = req.query;
        if (walletId) {
            if (!isValidObjectId(walletId)) {
                return res.status(400).json({ success: false, message: 'ID ví không hợp lệ.' });
            }
            const balance = await getWalletBalance(req.user.id, walletId);
            return res.json({
                success: true,
                data: {
                    [walletId]: balance
                }
            });
        }

        const balances = await getAllWalletBalances(req.user.id);
        res.json({
            success: true,
            data: balances
        });
    } catch (error) {
        console.error('GET /api/wallets/balances error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi tính số dư ví.' });
    }
});

// =============================================
// POST /api/wallets — Tạo ví mới
// =============================================
router.post('/', async (req, res) => {
    try {
        const { name, type, icon, color, initialBalance, creditLimit, isExcludedFromTotal, isDefault } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Tên ví không được để trống.' });
        }

        const validTypes = ['cash', 'bank', 'e-wallet', 'credit', 'savings'];
        const walletType = validTypes.includes(type) ? type : 'cash';

        if (isDefault) {
            await Wallet.updateMany({ userId: req.user.id }, { isDefault: false });
        }

        const newWallet = await Wallet.create({
            userId: req.user.id,
            name: name.trim(),
            type: walletType,
            icon: icon || (walletType === 'bank' ? '🏦' : walletType === 'credit' ? '💳' : walletType === 'e-wallet' ? '📱' : '💵'),
            color: color || '#2ed573',
            initialBalance: isFiniteInteger(initialBalance) ? Number(initialBalance) : 0,
            creditLimit: isValidVNDAmount(creditLimit, { allowZero: true }) ? Number(creditLimit) : 0,
            isExcludedFromTotal: Boolean(isExcludedFromTotal),
            isDefault: Boolean(isDefault)
        });

        res.status(201).json({
            success: true,
            message: 'Tạo ví mới thành công!',
            data: newWallet.toJSON()
        });
    } catch (error) {
        console.error('POST /api/wallets error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi tạo ví mới.' });
    }
});

// =============================================
// PUT /api/wallets/:id — Cập nhật ví
// =============================================
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'ID ví không hợp lệ.' });
        }

        const { name, type, icon, color, initialBalance, creditLimit, isExcludedFromTotal, isDefault } = req.body;

        const wallet = await Wallet.findOne({ _id: id, userId: req.user.id, archived: false });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ví.' });
        }

        if (name && name.trim()) wallet.name = name.trim();
        if (type && ['cash', 'bank', 'e-wallet', 'credit', 'savings'].includes(type)) wallet.type = type;
        if (icon !== undefined) wallet.icon = icon;
        if (color !== undefined) wallet.color = color;
        if (initialBalance !== undefined && isFiniteInteger(initialBalance)) wallet.initialBalance = Number(initialBalance);
        if (creditLimit !== undefined && isValidVNDAmount(creditLimit, { allowZero: true })) wallet.creditLimit = Number(creditLimit);
        if (isExcludedFromTotal !== undefined) wallet.isExcludedFromTotal = Boolean(isExcludedFromTotal);

        if (isDefault && !wallet.isDefault) {
            await Wallet.updateMany({ userId: req.user.id }, { isDefault: false });
            wallet.isDefault = true;
        }

        await wallet.save();

        res.json({
            success: true,
            message: 'Cập nhật ví thành công!',
            data: wallet.toJSON()
        });
    } catch (error) {
        console.error('PUT /api/wallets/:id error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi cập nhật ví.' });
    }
});

// =============================================
// DELETE /api/wallets/:id — Xóa ví (Bảo toàn initialBalance và chuyển giao dịch về ví mặc định)
// =============================================
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'ID ví không hợp lệ.' });
        }

        const walletCount = await Wallet.countDocuments({ userId: req.user.id, archived: false });
        if (walletCount <= 1) {
            return res.status(400).json({ success: false, message: 'Bạn không thể xóa ví duy nhất còn lại.' });
        }

        const result = await runWithTransaction(async (session) => {
            // 1. CHECKS
            const queryDel = Wallet.findOne({ _id: id, userId: req.user.id, archived: false });
            if (session) queryDel.session(session);
            const walletToDelete = await queryDel;

            if (!walletToDelete) {
                const err = new Error('WALLET_NOT_FOUND');
                err.status = 404;
                throw err;
            }

            // Tìm ví mặc định hoặc ví thay thế khác để nhận lại các giao dịch & initialBalance
            let queryDef = Wallet.findOne({ _id: { $ne: id }, userId: req.user.id, isDefault: true, archived: false });
            if (session) queryDef.session(session);
            let defaultWallet = await queryDef;

            if (!defaultWallet) {
                let queryAny = Wallet.findOne({ _id: { $ne: id }, userId: req.user.id, archived: false });
                if (session) queryAny.session(session);
                defaultWallet = await queryAny;
                if (defaultWallet) {
                    defaultWallet.isDefault = true;
                }
            }

            if (!defaultWallet) {
                const err = new Error('NO_FALLBACK_WALLET');
                err.status = 400;
                throw err;
            }

            // 2. EFFECTS
            // A. Chuyển toàn bộ giao dịch từ ví bị xóa sang ví mặc định
            const updateOpts = session ? { session } : {};
            await Transaction.updateMany(
                { walletId: id, userId: req.user.id },
                { $set: { walletId: defaultWallet._id } },
                updateOpts
            );
            await Transaction.updateMany(
                { toWalletId: id, userId: req.user.id },
                { $set: { toWalletId: defaultWallet._id } },
                updateOpts
            );

            // B. Bảo toàn 100% initialBalance: cộng dồn vào ví mặc định (Zero Data Loss thực sự)
            const transferInitialBalance = Number(walletToDelete.initialBalance) || 0;
            if (transferInitialBalance !== 0) {
                defaultWallet.initialBalance = (Number(defaultWallet.initialBalance) || 0) + transferInitialBalance;
            }
            await defaultWallet.save(session ? { session } : {});

            // C. Xóa ví
            const delQuery = Wallet.findOneAndDelete({ _id: id, userId: req.user.id });
            if (session) delQuery.session(session);
            await delQuery;

            return {
                fallbackWalletId: defaultWallet._id.toString()
            };
        });

        res.json({
            success: true,
            message: 'Đã xóa ví, bảo toàn số dư gốc và chuyển các giao dịch liên quan về ví mặc định!',
            fallbackWalletId: result.fallbackWalletId
        });
    } catch (error) {
        if (error.message === 'WALLET_NOT_FOUND') {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ví cần xóa.' });
        }
        if (error.message === 'NO_FALLBACK_WALLET') {
            return res.status(400).json({ success: false, message: 'Không tìm thấy ví thay thế hợp lệ.' });
        }
        console.error('DELETE /api/wallets/:id error:', error);
        res.status(error.status || 500).json({ success: false, message: error.message || 'Lỗi khi xóa ví.' });
    }
});

module.exports = router;
