'use strict';
const mongoose = require('mongoose');
mongoose.set('transactionAsyncLocalStorage', true);
async function runWithTransaction(workFn) {
    if (mongoose.connection.readyState !== 1) {
        throw new Error('Database is unavailable.');
    }
    const active = mongoose.transactionAsyncLocalStorage?.getStore()?.session;
    if (active) return workFn(active);
    return mongoose.connection.transaction(workFn, {
        readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' },
        readPreference: 'primary', maxCommitTimeMS: 10000
    });
}
module.exports = { runWithTransaction };
