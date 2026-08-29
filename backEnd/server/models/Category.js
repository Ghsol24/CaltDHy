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

/**
 * Helper static: Đảm bảo category tồn tại trong DB, nếu chưa có thì tự động tạo mới (case-insensitive).
 * Dùng findOneAndUpdate({ upsert: true }) — một lệnh DB nguyên tử duy nhất — thay vì
 * find-rồi-create (2 lệnh riêng biệt), nên không còn race condition giữa 2 request đồng thời.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string} categoryName
 * @returns {Promise<Document|null>}
 */
categorySchema.statics.ensureCategory = async function (userId, categoryName) {
    if (!categoryName || typeof categoryName !== 'string' || !categoryName.trim()) {
        return null;
    }
    // Bỏ qua nếu DB chưa kết nối (offline mode hoặc unit/contract test không có DB)
    if (mongoose.connection.readyState !== 1 && mongoose.connection.readyState !== 2) {
        return null;
    }

    const trimmed = categoryName.trim();
    const nameLower = trimmed.toLowerCase();
    const userObjectId = new mongoose.Types.ObjectId(userId);

    try {
        return await this.findOneAndUpdate(
            { userId: userObjectId, nameLower },
            { $setOnInsert: { userId: userObjectId, name: trimmed, nameLower } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    } catch (err) {
        // Trường hợp hiếm: 2 upsert va chạm đúng lúc unique index chưa kịp thấy nhau (E11000).
        // Đọc lại bản ghi mà request kia vừa tạo, thay vì để lỗi lan ra ngoài.
        if (err && err.code === 11000) {
            return this.findOne({ userId: userObjectId, nameLower });
        }
        throw err;
    }
};

/**
 * Bản "an toàn" của ensureCategory: không bao giờ throw ra ngoài.
 * Đây là thao tác bookkeeping phụ (đồng bộ danh mục) — nếu nó lỗi (mất kết nối tạm thời,
 * timeout...), KHÔNG được để lỗi đó làm hỏng response của thao tác chính (tạo giao dịch,
 * cập nhật category, tạo khoản định kỳ...) vốn đã ghi dữ liệu thành công.
 * Các route nên gọi hàm này thay vì gọi thẳng ensureCategory.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string} categoryName
 * @returns {Promise<Document|null>}
 */
categorySchema.statics.ensureCategorySafe = async function (userId, categoryName) {
    try {
        return await this.ensureCategory(userId, categoryName);
    } catch (err) {
        console.error('⚠️  Category.ensureCategory thất bại (bỏ qua, không chặn thao tác chính):', err.message);
        return null;
    }
};

module.exports = mongoose.model('Category', categorySchema);
