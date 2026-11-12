const mongoose = require('mongoose');

/**
 * Một thiết bị/trình duyệt đã đồng ý nhận thông báo đẩy. Chỉ lưu endpoint: thông báo được gửi
 * không kèm nội dung (service worker tự hiển thị lời nhắc), nên không cần khóa mã hóa của thiết bị.
 */
const pushSubscriptionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true, maxlength: 1000 }
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
