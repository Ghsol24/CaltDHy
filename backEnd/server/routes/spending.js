const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Wallet = require('../models/Wallet');
const User = require('../models/User');

// Tất cả các routes chi tiêu đều cần đăng nhập để xác thực
router.use(protect);

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function parseTransactionDate(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : parsed;
}

function validateTransactionPayload({ type, amount, category, date }) {
    if (!type || amount === undefined || amount === null || !category || !date) {
        return 'Vui lòng điền đầy đủ các thông tin bắt buộc.';
    }
    if (!['income', 'expense', 'transfer'].includes(type)) return 'Loại giao dịch không hợp lệ.';
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return 'Số tiền phải lớn hơn 0.';
    if (typeof category !== 'string' || !category.trim()) return 'Danh mục không hợp lệ.';
    if (!parseTransactionDate(date)) return 'Định dạng ngày không hợp lệ (YYYY-MM-DD).';
    return null;
}

// =============================================
// GET /api/spending/categories – Lấy danh mục tự định nghĩa của user
// =============================================
router.get('/categories', async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('customCategories');
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy user.' });
        }
        res.json({
            success: true,
            data: user.customCategories || []
        });
    } catch (error) {
        console.error('GET /api/spending/categories error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi tải danh mục.' });
    }
});

// =============================================
// PUT /api/spending/categories – Cập nhật danh mục tự định nghĩa
// =============================================
router.put('/categories', async (req, res) => {
    try {
        const { categories } = req.body;
        if (!Array.isArray(categories)) {
            return res.status(400).json({ success: false, message: 'Dữ liệu danh mục không hợp lệ.' });
        }

        const cleanCategories = categories
            .map(c => (typeof c === 'string' ? c.trim() : ''))
            .filter(c => c.length > 0 && c.length <= 50);

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { customCategories: cleanCategories },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy user.' });
        }

        res.json({
            success: true,
            message: 'Đã cập nhật danh mục thành công!',
            data: updatedUser.customCategories
        });
    } catch (error) {
        console.error('PUT /api/spending/categories error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi cập nhật danh mục.' });
    }
});

// =============================================
// GET /api/spending/budget – Lấy ngân sách của user
// =============================================
router.get('/budget', async (req, res) => {
    try {
        const budgets = await Budget.find({ userId: req.user.id });
        const budgetMap = {};
        budgets.forEach(b => {
            budgetMap[b.category] = b.limit;
        });

        res.json({
            success: true,
            data: budgetMap
        });
    } catch (error) {
        console.error('GET /api/spending/budget error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi tải ngân sách.' });
    }
});

// =============================================
// PUT /api/spending/budget – Cập nhật hạn mức ngân sách
// Dùng bulkWrite upsert thay vì delete-all + reinsert để tránh mất data
// =============================================
router.put('/budget', async (req, res) => {
    try {
        const budgetsObj = req.body; // Cấu trúc: { "Food & Dining": 500000, "Cà phê": 200000 }

        if (!budgetsObj || typeof budgetsObj !== 'object' || Array.isArray(budgetsObj)) {
            return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ.' });
        }

        // Lọc các category hợp lệ (limit > 0)
        const validEntries = Object.entries(budgetsObj)
            .filter(([cat, limit]) => typeof cat === 'string' && cat.trim() && Number(limit) > 0);

        const validCategories = validEntries.map(([cat]) => cat.trim());

        // Bước 1: Upsert tất cả budget hợp lệ (atomic từng item)
        if (validEntries.length > 0) {
            const bulkOps = validEntries.map(([category, limit]) => ({
                updateOne: {
                    filter: { userId: req.user.id, category: category.trim() },
                    update: { $set: { limit: Number(limit) } },
                    upsert: true
                }
            }));
            await Budget.bulkWrite(bulkOps);
        }

        // Bước 2: Xóa các category không còn trong list mới (hoặc limit = 0)
        await Budget.deleteMany({
            userId: req.user.id,
            category: { $nin: validCategories }
        });

        res.json({
            success: true,
            message: 'Đã cập nhật hạn mức chi tiêu thành công!',
            data: budgetsObj
        });
    } catch (error) {
        console.error('PUT /api/spending/budget error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lưu hạn mức chi tiêu.' });
    }
});

// =============================================
// GET /api/spending – Lấy danh sách giao dịch
// =============================================
router.get('/', async (req, res) => {
    try {
        const filter = { userId: req.user.id };

        if (req.query.walletId && isValidObjectId(req.query.walletId)) {
            filter.$or = [
                { walletId: req.query.walletId },
                { toWalletId: req.query.walletId }
            ];
        }

        const transactions = await Transaction.find(filter).sort({ date: -1, createdAt: -1 });

        res.json({
            success: true,
            data: transactions.map(t => t.toJSON())
        });
    } catch (error) {
        console.error('GET /api/spending error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách giao dịch.' });
    }
});

// =============================================
// POST /api/spending – Tạo giao dịch mới
// =============================================
router.post('/', async (req, res) => {
    try {
        const { type, desc, amount, category, date, walletId, toWalletId, fee, jarId, installmentId } = req.body;

        const validationError = validateTransactionPayload({ type, amount, category, date });
        if (validationError) return res.status(400).json({ success: false, message: validationError });

        const createPayload = {
            userId: req.user.id,
            type,
            desc: typeof desc === 'string' ? desc.trim() : '',
            amount: Number(amount),
            category: category.trim(),
            date: parseTransactionDate(date),
            fee: Number.isFinite(Number(fee)) && Number(fee) >= 0 ? Number(fee) : 0
        };
        if (isValidObjectId(walletId)) {
            createPayload.walletId = walletId;
        } else {
            const defWallet = await Wallet.findOne({ userId: req.user.id, isDefault: true, archived: false }) || await Wallet.findOne({ userId: req.user.id, archived: false });
            if (defWallet) createPayload.walletId = defWallet._id;
        }
        if (isValidObjectId(toWalletId)) createPayload.toWalletId = toWalletId;
        if (isValidObjectId(jarId)) createPayload.jarId = jarId;
        if (isValidObjectId(installmentId)) createPayload.installmentId = installmentId;

        const newRecord = await Transaction.create(createPayload);

        res.status(201).json({
            success: true,
            message: 'Đã lưu giao dịch!',
            data: newRecord.toJSON()
        });
    } catch (error) {
        console.error('POST /api/spending error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi tạo giao dịch.' });
    }
});

// =============================================
// PUT /api/spending/:id - Chỉnh sửa một giao dịch
// =============================================
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'ID giao dịch không hợp lệ.' });
        }

        const { type, desc, amount, category, date, walletId, toWalletId, fee, jarId, installmentId } = req.body;
        const validationError = validateTransactionPayload({ type, amount, category, date });
        if (validationError) return res.status(400).json({ success: false, message: validationError });

        const updatePayload = {
            type,
            desc: typeof desc === 'string' ? desc.trim() : '',
            amount: Number(amount),
            category: category.trim(),
            date: parseTransactionDate(date)
        };
        if (fee !== undefined) {
            updatePayload.fee = Number.isFinite(Number(fee)) && Number(fee) >= 0 ? Number(fee) : 0;
        }
        if (walletId !== undefined) {
            if (isValidObjectId(walletId)) {
                updatePayload.walletId = walletId;
            } else {
                const defWallet = await Wallet.findOne({ userId: req.user.id, isDefault: true, archived: false }) || await Wallet.findOne({ userId: req.user.id, archived: false });
                if (defWallet) updatePayload.walletId = defWallet._id;
            }
        }
        if (toWalletId !== undefined) {
            updatePayload.toWalletId = isValidObjectId(toWalletId) ? toWalletId : null;
        }
        if (jarId !== undefined) {
            updatePayload.jarId = isValidObjectId(jarId) ? jarId : null;
        }
        if (installmentId !== undefined) {
            updatePayload.installmentId = isValidObjectId(installmentId) ? installmentId : null;
        }

        const updated = await Transaction.findOneAndUpdate(
            { _id: id, userId: req.user.id },
            updatePayload,
            { new: true, runValidators: true }
        );

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch hoặc bạn không có quyền chỉnh sửa.' });
        }

        res.json({ success: true, message: 'Đã cập nhật giao dịch!', data: updated.toJSON() });
    } catch (error) {
        console.error('PUT /api/spending/:id error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi cập nhật giao dịch.' });
    }
});

// =============================================
// DELETE /api/spending/:id - Xóa giao dịch theo ID
// =============================================
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'ID giao dịch không hợp lệ.' });
        }
        const deleted = await Transaction.findOneAndDelete({ _id: id, userId: req.user.id });

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy giao dịch hoặc bạn không có quyền xóa.'
            });
        }

        res.json({
            success: true,
            message: 'Đã xóa giao dịch thành công!'
        });
    } catch (error) {
        console.error('DELETE /api/spending/:id error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi xóa giao dịch.' });
    }
});

module.exports = router;
