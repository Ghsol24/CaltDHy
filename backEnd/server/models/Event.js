const mongoose = require('mongoose');

/**
 * Schema: Event (Lịch trình / Sự kiện)
 * Tương đương với mảng `events` trong data.json cũ.
 * Field `id` ở response được map từ `_id` qua transform toJSON.
 */
const eventSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'userId không được để trống.'],
            index: true
        },
        title: {
            type: String,
            required: [true, 'Tên công việc không được để trống.'],
            trim: true,
            maxlength: [100, 'Tên công việc không được quá 100 ký tự.']
        },
        // Ngày theo định dạng 'YYYY-MM-DD'
        date: {
            type: String,
            required: [true, 'date không được để trống.'],
            match: [/^\d{4}-\d{2}-\d{2}$/, 'Định dạng date phải là YYYY-MM-DD.']
        },
        startTime:   { type: String, default: '' },
        endTime:     { type: String, default: '' },
        description: { type: String, default: '', maxlength: 500 },
        color:       { type: String, default: '#1877F2' }
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: false },
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

// Index để lọc nhanh theo (userId + date prefix) – dùng trong GET ?year&month
eventSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('Event', eventSchema);
