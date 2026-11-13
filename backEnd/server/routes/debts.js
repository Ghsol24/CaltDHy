'use strict';
// Sổ nợ và cho vay. Chỉ là sổ ghi nhớ: không thay đổi số dư ví hay sổ giao dịch.
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isValidVNDAmount } = require('../utils/money');
const { isValidDateString } = require('../utils/localDate');
const Debt = require('../models/Debt');

router.use(protect);
const MAX_DEBTS = 300;
const validId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
const text = (value, max) => (typeof value === 'string' && value.trim().length <= max ? value.trim() : null);
const fail = (res, event) => {
    console.error('[debts] ' + event);
    return res.status(500).json({ success: false, message: 'Không thể hoàn thành yêu cầu. Vui lòng thử lại.' });
};
const notFound = res => res.status(404).json({ success: false, message: 'Không tìm thấy khoản nợ.' });
const invalid = res => res.status(400).json({ success: false, message: 'Thông tin khoản nợ không hợp lệ.' });

/** Validated fields shared by create and update; null when anything is malformed. */
function debtFields(body, { partial = false } = {}) {
    const fields = {};
    const has = key => body[key] !== undefined;
    if (!partial || has('person')) {
        fields.person = text(body.person, 60);
        if (!fields.person) return null;
    }
    if (!partial || has('amount')) {
        if (!isValidVNDAmount(body.amount) || body.amount > 100000000000) return null;
        fields.amount = body.amount;
    }
    if (!partial || has('startDate')) {
        if (!isValidDateString(body.startDate)) return null;
        fields.startDate = body.startDate;
    }
    if (has('dueDate')) {
        if (body.dueDate !== null && body.dueDate !== '' && !isValidDateString(body.dueDate)) return null;
        fields.dueDate = body.dueDate || null;
    }
    if (has('note')) {
        fields.note = text(body.note, 500);
        if (fields.note === null) return null;
    }
    return fields;
}

router.get('/', async (req, res) => {
    try {
        const debts = await Debt.find({ userId: req.user.id }).sort({ createdAt: -1 });
        return res.json({ success: true, data: debts.map(debt => debt.toJSON()) });
    } catch { return fail(res, 'list_failed'); }
});

router.post('/', async (req, res) => {
    try {
        const body = req.body || {};
        const fields = debtFields(body);
        if (!fields || !['lent', 'borrowed'].includes(body.direction)) return invalid(res);
        if (fields.dueDate && fields.dueDate < fields.startDate) return invalid(res);
        if (await Debt.countDocuments({ userId: req.user.id }) >= MAX_DEBTS) {
            return res.status(400).json({ success: false, message: 'Sổ nợ đã đạt giới hạn 300 khoản. Hãy xóa bớt khoản đã tất toán.' });
        }
        const debt = await Debt.create({ ...fields, direction: body.direction, userId: req.user.id });
        return res.status(201).json({ success: true, message: 'Đã thêm khoản nợ.', data: debt.toJSON() });
    } catch { return fail(res, 'create_failed'); }
});

router.put('/:id', async (req, res) => {
    try {
        if (!validId(req.params.id)) return invalid(res);
        const fields = debtFields(req.body || {}, { partial: true });
        if (!fields) return invalid(res);
        const debt = await Debt.findOne({ _id: req.params.id, userId: req.user.id });
        if (!debt) return notFound(res);
        Object.assign(debt, fields);
        const paid = debt.payments.reduce((sum, payment) => sum + payment.amount, 0);
        if (debt.amount < paid) {
            return res.status(400).json({ success: false, message: 'Số tiền gốc không thể nhỏ hơn số đã trả.' });
        }
        if (debt.dueDate && debt.dueDate < debt.startDate) return invalid(res);
        await debt.save();
        return res.json({ success: true, message: 'Đã cập nhật khoản nợ.', data: debt.toJSON() });
    } catch (error) {
        if (error?.name === 'VersionError') return res.status(409).json({ success: false, message: 'Khoản nợ vừa thay đổi. Vui lòng tải lại và thử lại.' });
        return fail(res, 'update_failed');
    }
});

router.delete('/:id', async (req, res) => {
    try {
        if (!validId(req.params.id)) return invalid(res);
        const result = await Debt.deleteOne({ _id: req.params.id, userId: req.user.id });
        if (!result.deletedCount) return notFound(res);
        return res.json({ success: true, message: 'Đã xóa khoản nợ.' });
    } catch { return fail(res, 'delete_failed'); }
});

router.post('/:id/payments', async (req, res) => {
    try {
        const { amount, date, note } = req.body || {};
        const cleanNote = note === undefined ? '' : text(note, 200);
        if (!validId(req.params.id) || !isValidVNDAmount(amount) || !isValidDateString(date) || cleanNote === null) {
            return invalid(res);
        }
        const debt = await Debt.findOne({ _id: req.params.id, userId: req.user.id });
        if (!debt) return notFound(res);
        const paid = debt.payments.reduce((sum, payment) => sum + payment.amount, 0);
        if (amount > debt.amount - paid) {
            return res.status(400).json({ success: false, message: 'Số tiền trả vượt quá số còn nợ.' });
        }
        if (debt.payments.length >= 200) return invalid(res);
        debt.payments.push({ amount, date, note: cleanNote });
        await debt.save();
        return res.status(201).json({ success: true, message: 'Đã ghi lần trả.', data: debt.toJSON() });
    } catch (error) {
        if (error?.name === 'VersionError') return res.status(409).json({ success: false, message: 'Khoản nợ vừa thay đổi. Vui lòng tải lại và thử lại.' });
        return fail(res, 'payment_failed');
    }
});

router.delete('/:id/payments/:paymentId', async (req, res) => {
    try {
        if (!validId(req.params.id) || !validId(req.params.paymentId)) return invalid(res);
        const debt = await Debt.findOne({ _id: req.params.id, userId: req.user.id });
        const payment = debt?.payments.id(req.params.paymentId);
        if (!payment) return notFound(res);
        payment.deleteOne();
        await debt.save();
        return res.json({ success: true, message: 'Đã xóa lần trả.', data: debt.toJSON() });
    } catch (error) {
        if (error?.name === 'VersionError') return res.status(409).json({ success: false, message: 'Khoản nợ vừa thay đổi. Vui lòng tải lại và thử lại.' });
        return fail(res, 'payment_delete_failed');
    }
});

module.exports = router;
