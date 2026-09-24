'use strict';
const mongoose = require('mongoose');
module.exports = mongoose.model('MoneyLock', new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
    token: { type: String, required: true }
}, { versionKey: false }));
