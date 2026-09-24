'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    authVersion: { type: Number, required: true },
    expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });
module.exports = mongoose.model('AuthSession', schema);
