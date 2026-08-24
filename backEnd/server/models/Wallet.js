const mongoose = require('mongoose');

/**
 * Schema: Wallet (Ví / Tài khoản nguồn tiền)
 * Đại diện cho một ví vật lý hoặc tài khoản (Tiền mặt, Ngân hàng, Ví điện tử, Thẻ tín dụng, Tiết kiệm)
 */
const walletSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'userId không được để trống.'],
            index: true
        },
        name: {
            type: String,
            required: [true, 'Tên ví không được để trống.'],
            trim: true,
            maxlength: [50, 'Tên ví không được vượt quá 50 ký tự.']
        },
        type: {
            type: String,
            enum: {
                values: ['cash', 'bank', 'e-wallet', 'credit', 'savings'],
                message: 'Loại ví không hợp lệ.'
            },
            default: 'cash'
        },
        icon: {
            type: String,
            default: '💵',
            maxlength: [8, 'Icon không hợp lệ.']
        },
        color: {
            type: String,
            default: '#2ed573'
        },
        initialBalance: {
            type: Number,
            default: 0
        },
        creditLimit: {
            type: Number,
            default: 0
        },
        isExcludedFromTotal: {
            type: Boolean,
            default: false
        },
        isDefault: {
            type: Boolean,
            default: false
        },
        archived: {
            type: Boolean,
            default: false
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

walletSchema.index({ userId: 1, createdAt: 1 });

module.exports = mongoose.model('Wallet', walletSchema);
