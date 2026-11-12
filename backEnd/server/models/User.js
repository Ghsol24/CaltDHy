const mongoose = require('mongoose');

const cashFlowViewSchema = new mongoose.Schema({
    mode: { type: String, enum: ['daily', '3months', '6months'], required: true },
    series: { type: String, enum: ['expense', 'income', 'both'], required: true },
    excludeRecurring: { type: Boolean, required: true }
}, { _id: false });

/**
 * Schema: User
 * Tương đương với mảng `users` trong data.json cũ.
 * Field `id` ở response được map từ `_id` qua transform toJSON.
 */
const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Tên không được để trống.'],
            trim: true
        },
        email: {
            type: String,
            required: [true, 'Email không được để trống.'],
            unique: true,
            lowercase: true,
            trim: true
        },
        password: {
            type: String,
            required: [true, 'Mật khẩu không được để trống.'],
            select: false  // Không trả về mặc định – phải dùng .select('+password')
        },
        resetPasswordToken: {
            type: String,
            default: undefined,
            select: false
        },
        resetPasswordExpiry: {
            type: Date,
            default: undefined,
            select: false
        },
        passwordChangedAt: {
            type: Date,
            default: undefined
        },
        authVersion: { type: Number, default: 0, select: false },
        emailVerified: {
            type: Boolean,
            default: false
        },
        emailVerificationToken: {
            type: String,
            default: undefined,
            select: false
        },
        emailVerificationExpiry: {
            type: Date,
            default: undefined,
            select: false
        },
        // Danh mục chi tiêu tự định nghĩa – lưu trữ trên server để đồng bộ đa thiết bị
        customCategories: {
            type: [String],
            default: []
        },
        avatar: {
            type: String,
            default: ''
        },
        // Dấu chống gửi trùng của job nhắc; không phải tùy chọn của người dùng.
        lastInactivityEmailAt: { type: Date, default: null, select: false },
        lastDailyPushDate: { type: String, default: null, select: false },
        preferences: {
            analyticsExcludeRecurring: {
                type: Boolean,
                default: false
            },
            cashFlow: {
                lastUsed: { type: cashFlowViewSchema, default: null },
                pinnedDefault: { type: cashFlowViewSchema, default: null }
            },
            // Thông báo: mọi loại đều mặc định tắt, người dùng tự bật trong Cài đặt > Thông báo.
            notifications: {
                dueEmail: { type: Boolean, default: false },         // email khoản định kỳ sắp đến hạn
                inactivityEmail: { type: Boolean, default: false },  // email khi 3 ngày chưa ghi giao dịch
                dailyReminder: {                                     // thông báo đẩy nhắc ghi chép mỗi ngày
                    enabled: { type: Boolean, default: false },
                    hour: { type: Number, min: 6, max: 23, default: 21 } // giờ Việt Nam
                },
                locale: { type: String, enum: ['vi', 'en', 'zh-CN'], default: 'vi' },
                emailPausedUntil: { type: Date, default: null },     // "tạm dừng 30 ngày" từ link trong email
                promptDismissed: { type: Boolean, default: false }   // đã trả lời thẻ mời bật nhắc
            }
        }
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: false },
        // Tự động map _id -> id và loại bỏ __v khi trả về JSON
        toJSON: {
            virtuals: true,
            transform: (doc, ret) => {
                ret.id = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                delete ret.password;
                delete ret.authVersion;
                delete ret.resetPasswordToken;
                delete ret.resetPasswordExpiry;
                delete ret.emailVerificationToken;
                delete ret.emailVerificationExpiry;
                return ret;
            }
        }
    }
);

module.exports = mongoose.model('User', userSchema);
