const mongoose = require('mongoose');
const { getVietnamTodayString } = require('../utils/localDate');

// Audit events are separate from the money ledger: opening balances already
// belong to Wallet.initialBalance and must never count as income again.
const walletActivitySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true },
    type: { type: String, enum: ['wallet_created'], default: 'wallet_created' },
    walletName: { type: String, required: true },
    initialBalance: { type: Number, required: true, validate: Number.isSafeInteger },
    date: { type: String, default: getVietnamTodayString }
}, {
    timestamps: true,
    toJSON: {
        transform: (_doc, ret) => {
            ret.id = ret._id.toString();
            ret.userId = ret.userId.toString();
            ret.walletId = ret.walletId.toString();
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    }
});
walletActivitySchema.index({ userId: 1, createdAt: -1 });
module.exports = mongoose.model('WalletActivity', walletActivitySchema);
