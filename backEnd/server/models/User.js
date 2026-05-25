const mongoose = require('mongoose');

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
                delete ret.resetPasswordToken;
                delete ret.resetPasswordExpiry;
                return ret;
            }
        }
    }
);

module.exports = mongoose.model('User', userSchema);
