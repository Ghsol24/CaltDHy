'use strict';
const mongoose = require('mongoose');

// Store business fields rather than updatedAt so saving an unchanged form is not a revision.
// Snapshot IDs are strings and have no live references: deleting a transaction or wallet
// must not erase the evidence of a previous edit.
const snapshotSchema = new mongoose.Schema({
    id: { type: String, required: true },
    type: { type: String, required: true },
    desc: { type: String, default: '' },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    date: { type: String, required: true },
    walletId: { type: String, default: null },
    toWalletId: { type: String, default: null },
    fee: { type: Number, default: 0 },
    jarId: { type: String, default: null },
    installmentId: { type: String, default: null },
    systemGenerated: { type: Boolean, default: false },
    period: { type: String, default: null }
}, { _id: false });

const transactionRevisionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    action: { type: String, enum: ['update', 'delete'], required: true, immutable: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    actorName: { type: String, required: true, immutable: true },
    occurredAt: { type: Date, default: Date.now, required: true, immutable: true },
    changedFields: { type: [String], required: true, immutable: true },
    before: { type: snapshotSchema, required: true, immutable: true },
    after: { type: snapshotSchema, default: null, immutable: true }
}, {
    toJSON: {
        transform(doc, ret) {
            ret.id = ret._id.toString();
            for (const field of ['userId', 'transactionId', 'actorId']) ret[field] = ret[field].toString();
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    }
});

transactionRevisionSchema.index({ userId: 1, transactionId: 1, occurredAt: -1, _id: -1 });

module.exports = mongoose.model('TransactionRevision', transactionRevisionSchema);
