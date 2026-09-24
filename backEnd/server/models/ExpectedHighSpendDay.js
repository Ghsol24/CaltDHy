const mongoose = require('mongoose');

const expectedHighSpendDaySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }
}, { timestamps: true });

expectedHighSpendDaySchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('ExpectedHighSpendDay', expectedHighSpendDaySchema);
