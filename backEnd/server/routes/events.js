const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Event = require('../models/Event');

// Tất cả routes đều yêu cầu đăng nhập
router.use(protect);

// =============================================
// GET /api/events?year=2024&month=2
// Lấy tất cả sự kiện của user trong tháng
// =============================================
router.get('/', async (req, res) => {
    try {
        const { year, month } = req.query;
        const userId = req.user.id;

        let filter = { userId };

        // Lọc theo tháng nếu có truyền year & month
        if (year && month) {
            const paddedMonth = String(month).padStart(2, '0');
            const prefix = `${year}-${paddedMonth}`;
            // Dùng regex để match date bắt đầu bằng prefix "YYYY-MM"
            filter.date = { $regex: `^${prefix}` };
        }

        const events = await Event.find(filter).sort({ date: 1, startTime: 1 });

        res.json({ success: true, data: events.map(e => e.toJSON()) });
    } catch (error) {
        console.error('GET /api/events error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lấy dữ liệu lịch trình.' });
    }
});

// =============================================
// POST /api/events – Tạo sự kiện mới
// =============================================
router.post('/', async (req, res) => {
    try {
        const { title, date, startTime, endTime, description, color } = req.body;
        const userId = req.user.id;

        // Validate bắt buộc
        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập tên công việc.' });
        }
        if (!date) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn ngày.' });
        }
        if (title.trim().length > 100) {
            return res.status(400).json({ success: false, message: 'Tên công việc không được quá 100 ký tự.' });
        }
        // Validate màu hex (chỉ chấp nhận #RRGGBB)
        const safeColor = (color && /^#[0-9A-Fa-f]{6}$/.test(color)) ? color : '#1877F2';

        const newEvent = await Event.create({
            userId,
            title: title.trim(),
            date,
            startTime: startTime || '',
            endTime: endTime || '',
            description: (description || '').trim().slice(0, 500),
            color: safeColor
        });

        res.status(201).json({
            success: true,
            message: 'Đã thêm lịch trình!',
            data: newEvent.toJSON()
        });
    } catch (error) {
        console.error('POST /api/events error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi tạo lịch trình.' });
    }
});

// =============================================
// PUT /api/events/:id – Cập nhật sự kiện
// =============================================
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const { title, date, startTime, endTime, description, color } = req.body;

        // Xây dựng object update chỉ gồm các field được gửi lên
        const updateFields = {};
        if (title !== undefined)       updateFields.title = title.trim();
        if (date !== undefined)        updateFields.date = date;
        if (startTime !== undefined)   updateFields.startTime = startTime;
        if (endTime !== undefined)     updateFields.endTime = endTime;
        if (description !== undefined) updateFields.description = description.trim().slice(0, 500);
        // Validate màu hex trước khi lưu
        if (color !== undefined) {
            if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
                return res.status(400).json({ success: false, message: 'Màu không hợp lệ. Phải theo định dạng #RRGGBB.' });
            }
            updateFields.color = color;
        }

        const updatedEvent = await Event.findOneAndUpdate(
            { _id: id, userId },  // đảm bảo chỉ owner mới update được
            updateFields,
            { new: true, runValidators: true }
        );

        if (!updatedEvent) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch trình hoặc bạn không có quyền chỉnh sửa.'
            });
        }

        res.json({
            success: true,
            message: 'Đã cập nhật lịch trình!',
            data: updatedEvent.toJSON()
        });
    } catch (error) {
        console.error('PUT /api/events/:id error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi cập nhật lịch trình.' });
    }
});

// =============================================
// DELETE /api/events/:id – Xóa sự kiện
// =============================================
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const deleted = await Event.findOneAndDelete({ _id: id, userId });

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch trình hoặc bạn không có quyền xóa.'
            });
        }

        res.json({ success: true, message: 'Đã xóa lịch trình!' });
    } catch (error) {
        console.error('DELETE /api/events/:id error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi xóa lịch trình.' });
    }
});

module.exports = router;
