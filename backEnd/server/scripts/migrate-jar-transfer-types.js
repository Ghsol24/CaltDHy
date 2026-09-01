/**
 * One-time migration: fixes jar deposit/withdraw transactions that were
 * recorded as real 'expense'/'income' (categories "Other Expense" /
 * "Other Income") instead of internal 'transfer'. Those old records inflate
 * budget "Other Expense" totals and "Thu nhập tháng này" forever, since a
 * deposit is never offset by its matching withdrawal in category/income
 * stats. See routes/jars.js deposit/withdraw handlers for the forward fix
 * this migration backfills.
 *
 * Only touches Transaction documents that have jarId set AND type is
 * 'expense' or 'income' — safe to re-run: already-migrated rows become
 * type 'transfer' and are excluded from the selection on the next run.
 *
 * - Old deposit (type: 'expense', walletId set)   -> type: 'transfer', same walletId (money leaves the wallet)
 * - Old withdraw (type: 'income', walletId set)   -> type: 'transfer', walletId moved to toWalletId (money enters the wallet)
 *
 * Before running in production, back up the database, then run from
 * backEnd/server: node scripts/migrate-jar-transfer-types.js
 * Add --dry-run to preview the change count without writing anything.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');

async function migrate({ dryRun = false } = {}) {
    if (!process.env.MONGODB_URI) {
        throw new Error('Thiếu MONGODB_URI. Migration không thể kết nối cơ sở dữ liệu.');
    }

    console.log('🔄 Đang kết nối tới MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối cơ sở dữ liệu.');

    const legacyRecords = await Transaction.collection
        .find(
            { jarId: { $ne: null }, type: { $in: ['expense', 'income'] } },
            { projection: { _id: 1, type: 1, walletId: 1, toWalletId: 1 } }
        )
        .toArray();

    if (legacyRecords.length === 0) {
        console.log('✨ Không có giao dịch nạp/rút hũ nào cần chuyển sang type "transfer".');
        return { matched: 0, modified: 0 };
    }

    const deposits = legacyRecords.filter((r) => r.type === 'expense');
    const withdraws = legacyRecords.filter((r) => r.type === 'income');
    console.log(
        `🔎 Tìm thấy ${legacyRecords.length} giao dịch cần sửa ` +
        `(${deposits.length} nạp hũ, ${withdraws.length} rút hũ).`
    );

    if (dryRun) {
        console.log('🧪 Chế độ --dry-run: không ghi thay đổi nào vào database.');
        return { matched: legacyRecords.length, modified: 0 };
    }

    const operations = legacyRecords.map((record) => {
        if (record.type === 'expense') {
            // Nạp vào hũ: tiền rời khỏi ví -> giữ nguyên walletId, chỉ đổi type/category.
            return {
                updateOne: {
                    filter: { _id: record._id, type: 'expense' },
                    update: { $set: { type: 'transfer', category: 'Chuyển vào hũ' } }
                }
            };
        }
        // Rút từ hũ: tiền vào ví -> chuyển walletId cũ sang toWalletId, xoá walletId.
        return {
            updateOne: {
                filter: { _id: record._id, type: 'income' },
                update: {
                    $set: { type: 'transfer', category: 'Chuyển từ hũ', toWalletId: record.walletId },
                    $unset: { walletId: '' }
                }
            }
        };
    });

    const result = await Transaction.collection.bulkWrite(operations, { ordered: false });
    console.log(`🎉 Đã sửa ${result.modifiedCount} / ${legacyRecords.length} giao dịch nạp/rút hũ.`);
    return { matched: legacyRecords.length, modified: result.modifiedCount };
}

// Chạy trực tiếp từ CLI — không tự chạy nếu file này bị require() từ nơi khác.
if (require.main === module) {
    const dryRun = process.argv.includes('--dry-run');
    migrate({ dryRun })
        .catch((error) => {
            console.error('❌ Migration thất bại:', error.message);
            process.exitCode = 1;
        })
        .finally(async () => {
            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
                console.log('🔌 Đã ngắt kết nối database.');
            }
        });
}

module.exports = { migrate };
