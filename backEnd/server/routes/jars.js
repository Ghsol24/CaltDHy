const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Jar = require('../models/Jar');
const Installment = require('../models/Installment');

// Tất cả routes Jars đều yêu cầu xác thực
router.use(protect);

/* =============================================
   JARS (HŨ TIẾT KIỆM)
   ============================================= */

// GET /api/jars — Lấy tất cả hũ của user
router.get('/', async (req, res) => {
    try {
        const jars = await Jar.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json({ success: true, data: jars.map(j => j.toJSON()) });
    } catch (error) {
        console.error('GET /api/jars error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách hũ.' });
    }
});

// POST /api/jars — Tạo hũ mới
router.post('/', async (req, res) => {
    try {
        const { name, icon, target, current, targetDate, color } = req.body;

        if (!name || !target) {
            return res.status(400).json({ success: false, message: 'Tên và mục tiêu không được để trống.' });
        }
        if (Number(target) <= 0) {
            return res.status(400).json({ success: false, message: 'Mục tiêu phải lớn hơn 0.' });
        }

        const jar = await Jar.create({
            userId: req.user.id,
            name: name.trim(),
            icon: icon || '🫙',
            target: Number(target),
            current: Number(current) || 0,
            targetDate: targetDate || null,
            color: color || '#3498db'
        });

        res.status(201).json({ success: true, message: 'Đã tạo hũ mới!', data: jar.toJSON() });
    } catch (error) {
        console.error('POST /api/jars error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi tạo hũ.' });
    }
});

// PATCH /api/jars/:id/deposit — Nạp tiền vào hũ
router.patch('/:id/deposit', async (req, res) => {
    try {
        const { amount, reason } = req.body;
        if (!amount || Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'Số tiền nạp phải lớn hơn 0.' });
        }

        const jar = await Jar.findOne({ _id: req.params.id, userId: req.user.id });
        if (!jar) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hũ.' });
        }

        jar.current = jar.current + Number(amount);

        // Ghi lịch sử (thêm mới nhất lên đầu, giữ tối đa 200 entries)
        jar.history.unshift({
            type:   'deposit',
            amount: Number(amount),
            reason: (reason || '').trim().slice(0, 200),
            date:   new Date()
        });
        if (jar.history.length > 200) jar.history = jar.history.slice(0, 200);

        await jar.save();

        res.json({ success: true, message: 'Đã nạp tiền vào hũ!', data: jar.toJSON() });
    } catch (error) {
        console.error('PATCH /api/jars/:id/deposit error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi nạp tiền.' });
    }
});


// PATCH /api/jars/:id/withdraw — Rút tiền từ hũ
router.patch('/:id/withdraw', async (req, res) => {
    try {
        const { amount, reason } = req.body;
        if (!amount || Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'Số tiền rút phải lớn hơn 0.' });
        }

        const jar = await Jar.findOne({ _id: req.params.id, userId: req.user.id });
        if (!jar) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hũ.' });
        }
        if (Number(amount) > jar.current) {
            return res.status(400).json({ success: false, message: 'Số tiền rút vượt quá số dư trong hũ.' });
        }

        jar.current = jar.current - Number(amount);

        // Ghi lịch sử
        jar.history.unshift({
            type:   'withdraw',
            amount: Number(amount),
            reason: (reason || '').trim().slice(0, 200),
            date:   new Date()
        });
        if (jar.history.length > 200) jar.history = jar.history.slice(0, 200);

        await jar.save();

        res.json({ success: true, message: 'Đã rút tiền từ hũ!', data: jar.toJSON() });
    } catch (error) {
        console.error('PATCH /api/jars/:id/withdraw error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi rút tiền.' });
    }
});


// DELETE /api/jars/:id — Xóa hũ (tiền trong hũ không liên kết với balance)
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await Jar.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hũ.' });
        }
        res.json({ success: true, message: 'Đã xóa hũ!' });
    } catch (error) {
        console.error('DELETE /api/jars/:id error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi xóa hũ.' });
    }
});

/* =============================================
   INSTALLMENTS (TRẢ GÓP & HÓA ĐƠN ĐỊNH KỲ)
   ============================================= */

// GET /api/jars/installments — Lấy tất cả khoản định kỳ của user
router.get('/installments', async (req, res) => {
    try {
        const items = await Installment.find({ userId: req.user.id }).sort({ nextDueDate: 1 });
        res.json({ success: true, data: items.map(i => i.toJSON()) });
    } catch (error) {
        console.error('GET /api/jars/installments error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách trả góp.' });
    }
});

// POST /api/jars/installments — Tạo khoản định kỳ mới
router.post('/installments', async (req, res) => {
    try {
        const { name, icon, amount, cycle, nextDueDate } = req.body;

        if (!name || !amount || !cycle || !nextDueDate) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin.' });
        }
        if (!['monthly', 'quarterly', 'yearly'].includes(cycle)) {
            return res.status(400).json({ success: false, message: 'Chu kỳ không hợp lệ.' });
        }
        if (Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'Số tiền phải lớn hơn 0.' });
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)) {
            return res.status(400).json({ success: false, message: 'Định dạng ngày không hợp lệ (YYYY-MM-DD).' });
        }

        const item = await Installment.create({
            userId: req.user.id,
            name: name.trim(),
            icon: icon || '💳',
            amount: Number(amount),
            cycle,
            nextDueDate,
            active: true,
            totalPaid: 0
        });

        res.status(201).json({ success: true, message: 'Đã thêm khoản định kỳ!', data: item.toJSON() });
    } catch (error) {
        console.error('POST /api/jars/installments error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi tạo khoản định kỳ.' });
    }
});

// PATCH /api/jars/installments/:id/pay — Đánh dấu "Đã trả kỳ này" → tự động tính kỳ tiếp
router.patch('/installments/:id/pay', async (req, res) => {
    try {
        const item = await Installment.findOne({ _id: req.params.id, userId: req.user.id });
        if (!item) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy khoản định kỳ.' });
        }

        // Tính ngày đến hạn tiếp theo dựa vào cycle
        const current = new Date(item.nextDueDate + 'T00:00:00');
        let next = new Date(current);
        switch (item.cycle) {
            case 'monthly':   next.setMonth(next.getMonth() + 1);   break;
            case 'quarterly': next.setMonth(next.getMonth() + 3);   break;
            case 'yearly':    next.setFullYear(next.getFullYear() + 1); break;
        }
        const pad = n => String(n).padStart(2, '0');
        item.nextDueDate = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
        item.totalPaid = (item.totalPaid || 0) + item.amount;
        await item.save();

        res.json({ success: true, message: 'Đã đánh dấu thanh toán!', data: item.toJSON() });
    } catch (error) {
        console.error('PATCH /api/jars/installments/:id/pay error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi cập nhật kỳ thanh toán.' });
    }
});

// PATCH /api/jars/installments/:id/toggle — Bật/tắt theo dõi khoản định kỳ
router.patch('/installments/:id/toggle', async (req, res) => {
    try {
        const item = await Installment.findOne({ _id: req.params.id, userId: req.user.id });
        if (!item) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy khoản định kỳ.' });
        }
        item.active = !item.active;
        await item.save();
        res.json({ success: true, data: item.toJSON() });
    } catch (error) {
        console.error('PATCH /api/jars/installments/:id/toggle error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi cập nhật trạng thái.' });
    }
});

// DELETE /api/jars/installments/:id — Xóa khoản định kỳ
router.delete('/installments/:id', async (req, res) => {
    try {
        const deleted = await Installment.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy khoản định kỳ.' });
        }
        res.json({ success: true, message: 'Đã xóa khoản định kỳ!' });
    } catch (error) {
        console.error('DELETE /api/jars/installments/:id error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi xóa khoản định kỳ.' });
    }
});

module.exports = router;
