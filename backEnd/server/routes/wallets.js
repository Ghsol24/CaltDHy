const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

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
            initialBalance: Number.isFinite(Number(initialBalance)) ? Number(initialBalance) : 0,
            creditLimit: Number.isFinite(Number(creditLimit)) ? Number(creditLimit) : 0,
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
        if (initialBalance !== undefined && Number.isFinite(Number(initialBalance))) wallet.initialBalance = Number(initialBalance);
        if (creditLimit !== undefined && Number.isFinite(Number(creditLimit))) wallet.creditLimit = Number(creditLimit);
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
// DELETE /api/wallets/:id — Xóa ví (Chuyển giao dịch về ví mặc định)
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

        const walletToDelete = await Wallet.findOne({ _id: id, userId: req.user.id, archived: false });
        if (!walletToDelete) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ví cần xóa.' });
        }

        // Tìm ví mặc định để nhận lại các giao dịch
        let defaultWallet = await Wallet.findOne({ _id: { $ne: id }, userId: req.user.id, isDefault: true, archived: false });
        if (!defaultWallet) {
            defaultWallet = await Wallet.findOne({ _id: { $ne: id }, userId: req.user.id, archived: false });
            if (defaultWallet) {
                defaultWallet.isDefault = true;
                await defaultWallet.save();
            }
        }

        // Chuyển toàn bộ giao dịch từ ví bị xóa sang ví mặc định (Zero Data Loss)
        if (defaultWallet) {
            await Transaction.updateMany(
                { walletId: id, userId: req.user.id },
                { $set: { walletId: defaultWallet._id } }
            );
            await Transaction.updateMany(
                { toWalletId: id, userId: req.user.id },
                { $set: { toWalletId: defaultWallet._id } }
            );
        }

        await Wallet.findOneAndDelete({ _id: id, userId: req.user.id });

        res.json({
            success: true,
            message: 'Đã xóa ví và chuyển các giao dịch liên quan về ví mặc định!',
            fallbackWalletId: defaultWallet ? defaultWallet._id.toString() : null
        });
    } catch (error) {
        console.error('DELETE /api/wallets/:id error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi xóa ví.' });
    }
});

module.exports = router;
