'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    key: { type: String, required: true },
    fingerprint: { type: String, required: true },
    status: { type: Number, required: true },
    // Keep the legacy body for rolling deploys/rollback. Only responses with
    // keys stripped by Mongoose's object cloning need an exact JSON copy.
    body: { type: mongoose.Schema.Types.Mixed, required: true },
    bodyJson: { type: String }
}, { timestamps: true });
// No TTL: an old retry must never create another financial entry.
schema.index({ userId: 1, key: 1 }, { unique: true });
module.exports = mongoose.model('IdempotencyReceipt', schema);
