'use strict';
const mongoose = require('mongoose');

// Bản tỷ giá tham chiếu mới nhất, dùng chung cho mọi tài khoản và chỉ để HIỂN THỊ.
// Không gắn với người dùng, không đi vào giao dịch, số dư hay phép tính nào.
const schema = new mongoose.Schema({
    pair: { type: String, required: true, unique: true, enum: ['USD_VND'] },
    vndPerUsd: { type: Number, required: true, min: 1000, max: 1000000 },
    source: { type: String, required: true, trim: true, maxlength: 80 },
    sourceUrl: { type: String, default: '', maxlength: 200 },
    // Thời điểm nhà cung cấp công bố tỷ giá.
    asOf: { type: Date, required: true },
    // Lần cuối máy chủ lấy được bản này từ nguồn.
    fetchedAt: { type: Date, required: true }
}, { timestamps: false, versionKey: false });

module.exports = mongoose.model('ExchangeRate', schema);
