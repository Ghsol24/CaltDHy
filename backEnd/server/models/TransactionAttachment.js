'use strict';
const mongoose = require('mongoose');

// Ảnh hóa đơn đính kèm một giao dịch. Lưu ngay trong MongoDB (ảnh đã được nén ở trình duyệt)
// để không phụ thuộc ổ đĩa của máy chủ; giới hạn kích thước và số lượng nằm ở route.
const schema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    mime: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
    size: { type: Number, required: true, min: 1 },
    data: { type: Buffer, required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ userId: 1, transactionId: 1 });
module.exports = mongoose.model('TransactionAttachment', schema);
