'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    authVersion: { type: Number, required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    // Chỉ để người dùng nhận ra thiết bị trong "Thiết bị đang đăng nhập"; không dùng để xác thực.
    userAgent: { type: String, default: '', maxlength: 300 },
    lastSeenAt: { type: Date, default: Date.now }
}, { timestamps: true });
module.exports = mongoose.model('AuthSession', schema);
