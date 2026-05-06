const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { readData, writeData } = require('../utils/fileDB');

// Tất cả routes đều yêu cầu đăng nhập
router.use(protect);

// =============================================
// GET /api/spending/budget  (phải đặt TRƯỚC /:date để không bị conflict)
// =============================================
router.get('/budget', async (req, res) => {
    try {
        const db = await readData();
        const allBudgets = db.budgets || [];

        const budget = allBudgets.find(b => b.userId === req.user.id);

        res.json({
            success: true,
            data: budget ? {
                monthlyLimit: budget.monthlyLimit,
                dailyLimit: budget.dailyLimit
            } : {
                monthlyLimit: 0,
                dailyLimit: 0
            }
        });
    } catch (error) {
        console.error('GET /api/spending/budget error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lấy hạn mức chi tiêu.' });
    }
});

// =============================================
// PUT /api/spending/budget
// =============================================
router.put('/budget', async (req, res) => {
    try {
        const { monthlyLimit = 0, dailyLimit = 0 } = req.body;

        const db = await readData();
        if (!db.budgets) db.budgets = [];

        const index = db.budgets.findIndex(b => b.userId === req.user.id);

        let savedBudget;

        if (index >= 0) {
            db.budgets[index].monthlyLimit = monthlyLimit || 0;
            db.budgets[index].dailyLimit = dailyLimit || 0;
            savedBudget = db.budgets[index];
        } else {
            savedBudget = {
                id: Date.now().toString(),
                userId: req.user.id,
                monthlyLimit: monthlyLimit || 0,
                dailyLimit: dailyLimit || 0
            };
            db.budgets.push(savedBudget);
        }

        await writeData(db);

        res.json({
            success: true,
            message: 'Đã lưu hạn mức chi tiêu!',
            data: { monthlyLimit: savedBudget.monthlyLimit, dailyLimit: savedBudget.dailyLimit }
        });
    } catch (error) {
        console.error('PUT /api/spending/budget error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lưu hạn mức chi tiêu.' });
    }
});

// =============================================
// GET /api/spending?year=2026&month=3
// =============================================
router.get('/', async (req, res) => {
    try {
        const { year, month } = req.query;

        if (!year || !month) {
            return res.status(400).json({ success: false, message: 'Thiếu tham số year hoặc month.' });
        }

        const db = await readData();
        const allSpendings = db.spendings || [];

        const records = allSpendings.filter(item =>
            item.userId === req.user.id &&
            item.year === parseInt(year) &&
            item.month === parseInt(month)
        );

        records.sort((a, b) => a.day - b.day);

        res.json({ success: true, data: records });
    } catch (error) {
        console.error('GET /api/spending error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lấy dữ liệu chi tiêu.' });
    }
});

// =============================================
// PUT /api/spending/:date
// =============================================
router.put('/:date', async (req, res) => {
    try {
        const { date } = req.params;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ success: false, message: 'Định dạng ngày không hợp lệ (YYYY-MM-DD).' });
        }

        const [year, month, day] = date.split('-').map(Number);
        const { food = 0, gas = 0, coffee = 0, misc = 0, longTerm = {} } = req.body;

        const ltTotal = Object.values(longTerm).reduce((a, b) => a + (Number(b) || 0), 0);
        const total = (food || 0) + (gas || 0) + (coffee || 0) + (misc || 0) + ltTotal;

        const db = await readData();
        if (!db.spendings) db.spendings = [];

        const index = db.spendings.findIndex(item =>
            item.userId === req.user.id &&
            item.date === date
        );

        let savedRecord;

        if (index >= 0) {
            db.spendings[index] = {
                ...db.spendings[index],
                food: food || 0,
                gas: gas || 0,
                coffee: coffee || 0,
                misc: misc || 0,
                longTerm: longTerm,
                total: total
            };
            savedRecord = db.spendings[index];
        } else {
            savedRecord = {
                id: Date.now().toString(),
                userId: req.user.id,
                date, year, month, day,
                food: food || 0,
                gas: gas || 0,
                coffee: coffee || 0,
                misc: misc || 0,
                longTerm: longTerm,
                total: total
            };
            db.spendings.push(savedRecord);
        }

        await writeData(db);

        res.json({
            success: true,
            message: `Đã lưu chi tiêu ngày ${date}!`,
            data: savedRecord
        });
    } catch (error) {
        console.error('PUT /api/spending/:date error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lưu dữ liệu chi tiêu.' });
    }
});

module.exports = router;
