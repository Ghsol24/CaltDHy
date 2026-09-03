const mongoose = require('mongoose');

/**
 * Schema: Budget (Hạn mức chi tiêu theo danh mục)
 * Mỗi document lưu trữ hạn mức của 1 user đối với 1 danh mục chi tiêu cụ thể.
 * Tương thích với cấu trúc Frontend: { 'Category Name': Limit }
 */
const budgetSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'userId không được để trống.'],
            index: true
        },
        category: {
            type: String,
            required: [true, 'category không được để trống.'],
            trim: true
        },
        limit: {
            type: Number,
            required: [true, 'limit không được để trống.'],
            min: [0, 'Hạn mức không được âm.'],
            max: [100000000000, 'Hạn mức không vượt quá 100 tỷ VNĐ.']
        },
        month: {
            type: String,
            default: 'global',
            trim: true,
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
                delete ret._id;
                delete ret.__v;
                return ret;
            }
        }
    }
);

// Ràng buộc unique: Một user chỉ có 1 hạn mức cho mỗi danh mục trong 1 tháng cụ thể (hoặc global)
budgetSchema.index({ userId: 1, month: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
