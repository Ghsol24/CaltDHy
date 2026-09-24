const mongoose = require('mongoose');

/**
 * Schema: Category (Danh mục chi tiêu / thu nhập)
 * Lưu trữ danh mục độc lập theo từng user
 */
const categorySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'userId không được để trống.'],
            index: true
        },
        name: {
            type: String,
            required: [true, 'Tên danh mục không được để trống.'],
            trim: true
        },
        // Bản sao chữ thường của `name`, dùng làm khóa so trùng không phân biệt hoa/thường.
        // Được set tường minh bởi ensureCategory/migration script (không dựa vào hook) để giữ
        // rõ ràng, dễ trace, và hoạt động đúng với findOneAndUpdate({ upsert: true }).
        nameLower: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        toJSON: {
            virtuals: true,
            transform: (doc, ret) => {
                ret.id = ret._id.toString();
                ret.userId = ret.userId.toString();
                delete ret._id;
                delete ret.__v;
                delete ret.nameLower;
                return ret;
            }
        }
    }
);

// Unique index THẬT trên (userId, nameLower) — đây là ràng buộc bắt buộc để chống trùng lặp
// category không phân biệt hoa/thường. Trước đây chỉ có index thường (không unique), khiến
// 2 request đồng thời có thể tạo 2 document trùng tên cho cùng 1 user.
categorySchema.index({ userId: 1, nameLower: 1 }, { unique: true });

// Category bookkeeping participates in the caller's transaction; failures abort it.
categorySchema.statics.ensureCategory = async function (userId, categoryName) {
    if (typeof categoryName !== 'string' || !categoryName.trim()) return null;
    const name = categoryName.trim();
    return this.findOneAndUpdate(
        { userId, nameLower: name.toLowerCase() },
        { $setOnInsert: { userId, name, nameLower: name.toLowerCase() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
};
categorySchema.statics.ensureCategorySafe = categorySchema.statics.ensureCategory;
module.exports = mongoose.model('Category', categorySchema);
