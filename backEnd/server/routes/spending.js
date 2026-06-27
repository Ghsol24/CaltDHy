const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const User = require('../models/User');

// Tất cả các routes chi tiêu đều cần đăng nhập để xác thực
router.use(protect);

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
        res.status(500).json({ success: false, message: 'Lỗi khi lấy danh mục.' });
    }
});

// =============================================
// PUT /api/spending/categories – Cập nhật danh mục tự định nghĩa của user
// Body: { categories: ['Cat1', 'Cat2', ...] }
// =============================================
router.put('/categories', async (req, res) => {
    try {
        const { categories } = req.body;

        if (!Array.isArray(categories)) {
            return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ. Cần mảng categories.' });
        }

        // Lọc: chỉ giữ string hợp lệ, trim whitespace, loại bỏ trùng lặp
        const cleaned = [...new Set(
            categories
                .filter(c => typeof c === 'string' && c.trim().length > 0)
                .map(c => c.trim())
        )];

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { customCategories: cleaned },
            { new: true, select: 'customCategories' }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy user.' });
        }

        res.json({
            success: true,
            message: 'Cập nhật danh mục thành công!',
            data: user.customCategories
        });
    } catch (error) {
        console.error('PUT /api/spending/categories error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi cập nhật danh mục.' });
    }
});

// =============================================
// GET /api/spending/budget - Lấy hạn mức ngân sách theo danh mục
// =============================================
router.get('/budget', async (req, res) => {
    try {
        const budgets = await Budget.find({ userId: req.user.id });
        const budgetObj = {};
        budgets.forEach(b => {
            budgetObj[b.category] = b.limit;
        });

        res.json({
            success: true,
            data: budgetObj
        });
    } catch (error) {
        console.error('GET /api/spending/budget error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lấy hạn mức chi tiêu.' });
    }
});

// =============================================
// PUT /api/spending/budget - Cập nhật hạn mức ngân sách
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
            .filter(([_, limit]) => limit && Number(limit) > 0);

        const validCategories = validEntries.map(([cat]) => cat);

        // Bước 1: Upsert tất cả budget hợp lệ (atomic từng item)
        if (validEntries.length > 0) {
            const bulkOps = validEntries.map(([category, limit]) => ({
                updateOne: {
                    filter: { userId: req.user.id, category },
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
// GET /api/spending - Lấy danh sách giao dịch của user
// Hỗ trợ lọc: ?year=2026&month=5
// Hỗ trợ phân trang: ?page=1&limit=50 (mặc định trả về tất cả nếu không có page)
// =============================================
router.get('/', async (req, res) => {
    try {
        const { year, month, page, limit } = req.query;
        let filter = { userId: req.user.id };

        // Lọc theo năm/tháng nếu có tham số
        if (year && month) {
            const paddedMonth = String(month).padStart(2, '0');
            const prefix = `${year}-${paddedMonth}`;
            filter.date = { $regex: `^${prefix}` };
        }

        const query = Transaction.find(filter).sort({ date: -1, createdAt: -1 });

        // Phân trang nếu có truyền `page`
        let pagination = null;
        if (page) {
            const pageNum  = Math.max(1, parseInt(page) || 1);
            const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
            const skip     = (pageNum - 1) * limitNum;
            const total    = await Transaction.countDocuments(filter);

            query.skip(skip).limit(limitNum);
            pagination = {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            };
        }

        const records = await query;

        res.json({
            success: true,
            data: records.map(r => r.toJSON()),
            ...(pagination && { pagination })
        });
    } catch (error) {
        console.error('GET /api/spending error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lấy dữ liệu chi tiêu.' });
    }
});

// =============================================
// POST /api/spending - Tạo giao dịch mới
// =============================================
router.post('/', async (req, res) => {
    try {
        const { type, desc, amount, category, date } = req.body;

        // Validation
        if (!type || !amount || !category || !date) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ các thông tin bắt buộc.' });
        }
        if (!['income', 'expense'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Loại giao dịch không hợp lệ.' });
        }
        if (Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'Số tiền phải lớn hơn 0.' });
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ success: false, message: 'Định dạng ngày không hợp lệ (YYYY-MM-DD).' });
        }

        const newRecord = await Transaction.create({
            userId: req.user.id,
            type,
            desc: (desc || '').trim(),
            amount: Number(amount),
            category: category.trim(),
            date
        });

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
// DELETE /api/spending/:id - Xóa giao dịch theo ID
// =============================================
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
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
