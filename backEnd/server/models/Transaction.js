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
        // Định dạng 'YYYY-MM-DD'
        date: {
            type: String,
            required: [true, 'date không được để trống.'],
            match: [/^\d{4}-\d{2}-\d{2}$/, 'Định dạng date phải là YYYY-MM-DD.']
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

// Index để tìm nhanh các giao dịch của user
transactionSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
