const mongoose = require('mongoose');

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
        }
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: (doc, ret) => {
                ret.id = ret._id.toString();
                ret.userId = ret.userId.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            }
        }
    }
);

installmentSchema.index({ userId: 1, nextDueDate: 1 });

module.exports = mongoose.model('Installment', installmentSchema);
