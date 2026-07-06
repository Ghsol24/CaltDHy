const mongoose = require('mongoose');

/**
 * Sub-schema: JarHistoryEntry — một lần nạp hoặc rút tiền
 */
const jarHistorySchema = new mongoose.Schema(
    {
        type:   { type: String, enum: ['deposit', 'withdraw'], required: true },
        amount: { type: Number, required: true, min: 1 },
        reason: { type: String, trim: true, maxlength: [200, 'Lý do không quá 200 ký tự.'], default: '' },
        date:   { type: Date, default: Date.now }
    },
    { _id: true }
);

/**
 * Schema: Jar (Hũ Tiết Kiệm)
 * Mỗi document đại diện cho một hũ tiết kiệm của user.
 * Hoàn toàn độc lập với balance/transactions — tiền trong hũ KHÔNG kết nối với số dư tổng.
 */
const jarSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'userId không được để trống.'],
            index: true
        },
        name: {
            type: String,
            required: [true, 'Tên hũ không được để trống.'],
            trim: true,
            maxlength: [50, 'Tên hũ không được vượt quá 50 ký tự.']
        },
        icon: {
            type: String,
            default: '🫙',
            maxlength: [8, 'Icon không hợp lệ.']
        },
        target: {
            type: Number,
            required: [true, 'Mục tiêu không được để trống.'],
            min: [1, 'Mục tiêu phải lớn hơn 0.']
        },
        current: {
            type: Number,
            default: 0,
            min: [0, 'Số tiền trong hũ không được âm.']
        },
        targetDate: {
            type: String, // ISO date string: 'YYYY-MM-DD'
            default: null
        },
        color: {
            type: String,
            default: '#3498db'
        },
        /**
         * Lịch sử nạp/rút — mỗi action ghi thêm một entry (max giữ 200 entries gần nhất)
         */
        history: {
            type: [jarHistorySchema],
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
                // Làm sạch history items
                if (Array.isArray(ret.history)) {
                    ret.history = ret.history.map(h => ({
                        id:     h._id ? h._id.toString() : undefined,
                        type:   h.type,
                        amount: h.amount,
                        reason: h.reason,
                        date:   h.date
                    }));
                }
                delete ret._id;
                delete ret.__v;
                return ret;
            }
        }
    }
);


jarSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Jar', jarSchema);
