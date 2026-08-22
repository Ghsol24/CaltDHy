/**
 * One-time migration: converts legacy Transaction.date strings (YYYY-MM-DD)
 * to MongoDB Date values. It is safe to re-run: only BSON string values are
 * selected, and already-migrated Date values are left untouched.
 *
 * Before running in production, back up the database, then run from
 * backEnd/server: node scripts/migrate-transaction-dates.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');

function parseIsoDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

async function migrate() {
    if (!process.env.MONGODB_URI) {
        throw new Error('Thiếu MONGODB_URI. Migration không thể kết nối cơ sở dữ liệu.');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    const legacyRecords = await Transaction.collection
        .find({ date: { $type: 'string' } }, { projection: { _id: 1, date: 1 } })
        .toArray();

    const invalid = legacyRecords.filter((record) => !parseIsoDate(record.date));
    if (invalid.length > 0) {
        throw new Error(`Dừng migration: ${invalid.length} giao dịch có date không hợp lệ.`);
    }

    if (legacyRecords.length === 0) {
        console.log('Không có giao dịch date kiểu String cần chuyển đổi.');
        return;
    }

    const result = await Transaction.collection.bulkWrite(
        legacyRecords.map((record) => ({
            updateOne: {
                filter: { _id: record._id, date: record.date },
                update: { $set: { date: parseIsoDate(record.date) } }
            }
        })),
        { ordered: false }
    );

    console.log(`Đã chuyển ${result.modifiedCount} / ${legacyRecords.length} giao dịch sang kiểu Date.`);
}

migrate()
    .catch((error) => {
        console.error('Migration thất bại:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
