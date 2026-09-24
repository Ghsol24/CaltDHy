const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema({
    email: { type: String, required: true, lowercase: true, trim: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null }
}, { timestamps: { createdAt: true, updatedAt: false } });

invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Invitation', invitationSchema);
