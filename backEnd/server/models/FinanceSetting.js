'use strict';
const mongoose = require('mongoose');

const criteriaSchema = new mongoose.Schema({
    query: { type: String, default: '', maxlength: 100 },
    type: { type: String, default: 'all' },
    category: { type: String, default: 'all', maxlength: 50 },
    walletId: { type: String, default: 'all' },
    tag: { type: String, default: 'all', maxlength: 30 },
    minAmount: { type: Number, default: null },
    maxAmount: { type: Number, default: null },
    datePreset: { type: String, default: 'all' },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    excludeRecurring: { type: Boolean, default: false }
}, { _id: false });

// Một bản ghi cho mỗi tài khoản: bộ lọc giao dịch đã lưu và các tùy chọn ngân sách nâng cao.
// Không chứa số dư hay giao dịch, nên không đi qua hàng rào sổ cái.
const schema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    savedFilters: {
        type: [new mongoose.Schema({
            name: { type: String, required: true, trim: true, maxlength: 40 },
            criteria: { type: criteriaSchema, required: true }
        }, { _id: true })],
        default: []
    },
    budget: {
        // 0 = chưa đặt. Hạn mức tổng áp cho toàn bộ chi tiêu của tháng, kể cả danh mục chưa có hạn mức.
        totalLimit: { type: Number, default: 0, min: 0, max: 100000000000, validate: Number.isSafeInteger },
        weeklyLimit: { type: Number, default: 0, min: 0, max: 100000000000, validate: Number.isSafeInteger },
        // Phần chưa dùng của tháng trước được cộng vào hạn mức danh mục của tháng này.
        rollover: { type: Boolean, default: false }
    }
}, { timestamps: true });
module.exports = mongoose.model('FinanceSetting', schema);
