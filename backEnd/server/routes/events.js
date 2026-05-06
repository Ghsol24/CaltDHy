const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { readData, writeData } = require('../utils/fileDB');

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

        const db = await readData();
        let events = db.events.filter(e => e.userId === userId);

        // Lọc theo tháng nếu có truyền year & month
        if (year && month) {
            const paddedMonth = String(month).padStart(2, '0');
            const prefix = `${year}-${paddedMonth}`;
            events = events.filter(e => e.date && e.date.startsWith(prefix));
        }

        // Sắp xếp tăng dần theo date và startTime
        events.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return (a.startTime || '').localeCompare(b.startTime || '');
        });

        res.json({ success: true, data: events });
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

        const db = await readData();

        const newEvent = {
            id: Date.now().toString(),
            userId,
            title: title.trim(),
            date,
            startTime: startTime || '',
            endTime: endTime || '',
            description: (description || '').trim().slice(0, 500),
            color: color || '#1877F2',
            createdAt: new Date().toISOString()
        };

        db.events.push(newEvent);
        await writeData(db);

        res.status(201).json({
            success: true,
            message: 'Đã thêm lịch trình!',
            data: newEvent
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

        const db = await readData();

        const index = db.events.findIndex(e => e.id === id && e.userId === userId);

        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch trình hoặc bạn không có quyền chỉnh sửa.'
            });
        }

        const { title, date, startTime, endTime, description, color } = req.body;
        const existing = db.events[index];

        db.events[index] = {
            ...existing,
            title: title !== undefined ? title.trim() : existing.title,
            date: date !== undefined ? date : existing.date,
            startTime: startTime !== undefined ? startTime : existing.startTime,
            endTime: endTime !== undefined ? endTime : existing.endTime,
            description: description !== undefined ? description.trim().slice(0, 500) : existing.description,
            color: color !== undefined ? color : existing.color
        };

        await writeData(db);

        res.json({
            success: true,
            message: 'Đã cập nhật lịch trình!',
            data: db.events[index]
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

        const db = await readData();

        const index = db.events.findIndex(e => e.id === id && e.userId === userId);

        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch trình hoặc bạn không có quyền xóa.'
            });
        }

        db.events.splice(index, 1);
        await writeData(db);

        res.json({ success: true, message: 'Đã xóa lịch trình!' });
    } catch (error) {
        console.error('DELETE /api/events/:id error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi xóa lịch trình.' });
    }
});

module.exports = router;
