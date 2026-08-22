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
            enum: ['income', 'expense']
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
        }
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: (doc, ret) => {
                ret.id = ret._id.toString();
                ret.userId = ret.userId.toString();
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

module.exports = mongoose.model('Transaction', transactionSchema);
