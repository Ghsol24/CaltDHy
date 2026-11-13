'use strict';
const mongoose = require('mongoose');
const { isValidDateString } = require('../utils/localDate');

const dateField = (required) => ({
    type: String, required, default: required ? undefined : null,
    validate: { validator: value => value == null || isValidDateString(value), message: 'Ngày không hợp lệ.' }
});
const paymentSchema = new mongoose.Schema({
    amount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    date: dateField(true),
    note: { type: String, default: '', trim: true, maxlength: 200 }
}, { _id: true });

/**
 * Sổ nợ: "A nợ mình" (lent) hoặc "mình nợ B" (borrowed), kèm hạn trả và các lần trả.
 * Đây là sổ ghi nhớ, không phải sổ cái: không tự cộng trừ số dư ví. Tiền thật vào/ra ví
 * vẫn được ghi bằng giao dịch thu/chi như bình thường.
 */
const debtSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    direction: { type: String, enum: ['lent', 'borrowed'], required: true, immutable: true },
    person: { type: String, required: true, trim: true, maxlength: 60 },
    amount: { type: Number, required: true, min: 1, max: 100000000000, validate: Number.isSafeInteger },
    startDate: dateField(true),
    dueDate: dateField(false),
    note: { type: String, default: '', trim: true, maxlength: 500 },
    payments: { type: [paymentSchema], default: [] }
}, {
    timestamps: true,
    // Hai lần ghi trả đồng thời không được cùng vượt qua kiểm tra "không trả quá số còn lại".
    optimisticConcurrency: true,
    toJSON: {
        transform(doc, ret) {
            ret.id = ret._id.toString();
            ret.userId = ret.userId.toString();
            ret.payments = (ret.payments || []).map(payment => ({
                id: payment._id.toString(), amount: payment.amount, date: payment.date, note: payment.note || ''
            }));
            ret.paid = ret.payments.reduce((sum, payment) => sum + payment.amount, 0);
            ret.remaining = Math.max(0, ret.amount - ret.paid);
            ret.settled = ret.remaining === 0;
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    }
});
module.exports = mongoose.model('Debt', debtSchema);
