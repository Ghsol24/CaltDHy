const mongoose = require('mongoose');

const installmentHistorySchema = new mongoose.Schema(
    {
        amount: { type: Number, required: true, min: 1 },
        paidDate: { type: String, required: true }, // 'YYYY-MM-DD'
        cycleDate: { type: String, default: '' },   // Ngày hạn của kỳ đó
        createdAt: { type: Date, default: Date.now }
    },
    { _id: true }
);

/**
 * Schema: Installment (Trả Góp & Hóa Đơn Định Kỳ)
 * Đại diện cho một khoản thanh toán định kỳ (Netflix, gym, trả góp điện thoại...)
 * cycle: 'monthly' | 'quarterly' | 'yearly'
 */
const installmentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'userId không được để trống.'],
            index: true
        },
        name: {
            type: String,
            required: [true, 'Tên khoản thanh toán không được để trống.'],
            trim: true,
            maxlength: [60, 'Tên không được vượt quá 60 ký tự.']
        },
        icon: {
            type: String,
            default: '💳',
            maxlength: [8, 'Icon không hợp lệ.']
        },
        amount: {
            type: Number,
            required: [true, 'Số tiền không được để trống.'],
            min: [1, 'Số tiền phải lớn hơn 0.']
        },
        cycle: {
            type: String,
            enum: {
                values: ['monthly', 'quarterly', 'yearly'],
                message: 'Chu kỳ phải là monthly, quarterly, hoặc yearly.'
            },
            required: [true, 'Chu kỳ không được để trống.']
        },
        nextDueDate: {
            type: String, // ISO date string: 'YYYY-MM-DD'
            required: [true, 'Ngày đến hạn tiếp theo không được để trống.']
        },
        active: {
            type: Boolean,
            default: true
        },
        totalPaid: {
            type: Number,
            default: 0
        },
        history: {
            type: [installmentHistorySchema],
            default: []
        }
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: (doc, ret) => {
                ret.id = ret._id.toString();
                ret.userId = ret.userId.toString();
                if (Array.isArray(ret.history)) {
                    ret.history = ret.history.map(h => ({
                        id: h._id ? h._id.toString() : undefined,
                        amount: h.amount,
                        paidDate: h.paidDate,
                        cycleDate: h.cycleDate,
                        createdAt: h.createdAt
                    }));
                }
                delete ret._id;
                delete ret.__v;
                return ret;
            }
        }
    }
);

installmentSchema.index({ userId: 1, nextDueDate: 1 });

module.exports = mongoose.model('Installment', installmentSchema);
