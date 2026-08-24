const mongoose = require('mongoose');

/**
 * Schema: Transaction (Giao dịch đơn lẻ)
 * Tương thích hoàn toàn với cấu trúc Frontend: { id, type, desc, amount, category, date }
 */
const transactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'userId không được để trống.'],
            index: true
        },
        type: {
            type: String,
            required: [true, 'type không được để trống.'],
            enum: ['income', 'expense', 'transfer']
        },
        desc: {
            type: String,
            default: '',
            trim: true
        },
        amount: {
            type: Number,
            required: [true, 'amount không được để trống.'],
            min: [0, 'amount không được âm.']
        },
        category: {
            type: String,
            required: [true, 'category không được để trống.'],
            trim: true
        },
        // Lưu dưới dạng Date để MongoDB có thể lọc và lập chỉ mục theo khoảng thời gian.
        // API vẫn trả về YYYY-MM-DD để tương thích với frontend hiện có.
        date: {
            type: Date,
            required: [true, 'date không được để trống.'],
        },
        walletId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Wallet',
            default: null,
            index: true
        },
        toWalletId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Wallet',
            default: null,
            index: true
        },
        fee: {
            type: Number,
            default: 0,
            min: [0, 'Phí giao dịch không được âm.']
        },
        jarId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Jar',
            default: null,
            index: true
        },
        installmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Installment',
            default: null,
            index: true
        }
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: (doc, ret) => {
                ret.id = ret._id.toString();
                ret.userId = ret.userId.toString();
                if (ret.walletId) ret.walletId = ret.walletId.toString();
                if (ret.toWalletId) ret.toWalletId = ret.toWalletId.toString();
                if (ret.jarId) ret.jarId = ret.jarId.toString();
                if (ret.installmentId) ret.installmentId = ret.installmentId.toString();
                ret.fee = ret.fee || 0;
                ret.date = ret.date.toISOString().slice(0, 10);
                delete ret._id;
                delete ret.__v;
                return ret;
            }
        }
    }
);

// Index để tìm nhanh các giao dịch của user
transactionSchema.index({ userId: 1, date: 1 });
transactionSchema.index({ userId: 1, walletId: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
