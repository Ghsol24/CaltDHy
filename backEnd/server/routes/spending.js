const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');

// Tất cả các routes chi tiêu đều cần đăng nhập để xác thực
router.use(protect);

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
// Ghi đè toàn bộ danh sách ngân sách của user đó
// =============================================
router.put('/budget', async (req, res) => {
    try {
        const budgetsObj = req.body; // Cấu trúc: { "Food & Dining": 500000, "Cà phê": 200000 }

        if (!budgetsObj || typeof budgetsObj !== 'object') {
            return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ.' });
        }

        // Xóa các ngân sách cũ của user này
        await Budget.deleteMany({ userId: req.user.id });

        // Chuẩn bị dữ liệu để insert mới
        const insertData = Object.entries(budgetsObj)
            .filter(([_, limit]) => limit && Number(limit) > 0)
            .map(([category, limit]) => ({
                userId: req.user.id,
                category,
                limit: Number(limit)
            }));

        if (insertData.length > 0) {
            await Budget.insertMany(insertData);
        }

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
// Hỗ trợ lọc theo query: ?year=2026&month=5
// =============================================
router.get('/', async (req, res) => {
    try {
        const { year, month } = req.query;
        let filter = { userId: req.user.id };

        // Lọc theo năm/tháng nếu có tham số
        if (year && month) {
            const paddedMonth = String(month).padStart(2, '0');
            const prefix = `${year}-${paddedMonth}`;
            // Dùng regex để khớp trường date bắt đầu bằng YYYY-MM
            filter.date = { $regex: `^${prefix}` };
        }

        const records = await Transaction.find(filter).sort({ date: -1, createdAt: -1 });

        res.json({
            success: true,
            data: records.map(r => r.toJSON())
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
