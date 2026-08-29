/**
 * Migration Script: migrate-budget-categories.js
 *
 * Mục tiêu:
 * 1. Chuẩn hóa category trong collection `budgets`:
 *    - 'Transport' -> 'Transportation'
 *    - 'Utilities' -> 'Housing & Bills'
 *    - Quy tắc ưu tiên người dùng: Nếu user đã có sẵn 'Transportation'/'Housing & Bills' (do tự set),
 *      xóa bản ghi cũ 'Transport'/'Utilities' (seed mặc định chưa dùng). Nếu chưa có, đổi tên bản ghi cũ.
 * 2. Cập nhật category trong collection `transactions`:
 *    - Đổi 'Transport' -> 'Transportation'
 *    - Đổi 'Utilities' -> 'Housing & Bills'
 * 3. Backfill category cho collection `installments`:
 *    - Bổ sung `category: 'Housing & Bills'` cho mọi installment legacy chưa có trường này.
 *
 * Cách chạy:
 *   cd backEnd/server && npm run migrate:categories
 *   hoặc: node scripts/migrate-budget-categories.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const Installment = require('../models/Installment');

async function migrateBudgetCategories() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error('Thiếu MONGODB_URI trong file .env. Không thể kết nối database.');
    }

    console.log('🔄 Đang kết nối tới MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối cơ sở dữ liệu.');

    // ========================================================
    // 1. Xử lý collection `budgets`
    // ========================================================
    console.log('\n📊 [1/3] Đang quét và chuẩn hóa collection `budgets`...');

    // A. Xử lý 'Transport' -> 'Transportation'
    const transportBudgets = await Budget.find({ category: 'Transport' });
    let transportDeleted = 0;
    let transportRenamed = 0;

    for (const b of transportBudgets) {
        const existingNew = await Budget.findOne({ userId: b.userId, category: 'Transportation' });
        if (existingNew) {
            // User đã tự tạo Transportation -> Xóa bản ghi Transport cũ để tránh trùng và bảo vệ cấu hình của user
            await Budget.deleteOne({ _id: b._id });
            transportDeleted++;
        } else {
            // User chưa có -> Đổi tên thành Transportation
            b.category = 'Transportation';
            await b.save();
            transportRenamed++;
        }
    }
    console.log(`   - Transport: Đã đổi tên ${transportRenamed} bản ghi, xóa ${transportDeleted} bản ghi dư thừa.`);

    // B. Xử lý 'Utilities' -> 'Housing & Bills'
    const utilitiesBudgets = await Budget.find({ category: 'Utilities' });
    let utilitiesDeleted = 0;
    let utilitiesRenamed = 0;

    for (const b of utilitiesBudgets) {
        const existingNew = await Budget.findOne({ userId: b.userId, category: 'Housing & Bills' });
        if (existingNew) {
            await Budget.deleteOne({ _id: b._id });
            utilitiesDeleted++;
        } else {
            b.category = 'Housing & Bills';
            await b.save();
            utilitiesRenamed++;
        }
    }
    console.log(`   - Utilities: Đã đổi tên ${utilitiesRenamed} bản ghi, xóa ${utilitiesDeleted} bản ghi dư thừa.`);

    // ========================================================
    // 2. Xử lý collection `transactions`
    // ========================================================
    console.log('\n💳 [2/3] Đang quét và chuẩn hóa collection `transactions`...');
    const txTransportRes = await Transaction.updateMany(
        { category: 'Transport' },
        { $set: { category: 'Transportation' } }
    );
    const txUtilitiesRes = await Transaction.updateMany(
        { category: 'Utilities' },
        { $set: { category: 'Housing & Bills' } }
    );
    console.log(`   - Giao dịch: Đã cập nhật ${txTransportRes.modifiedCount} Transport -> Transportation.`);
    console.log(`   - Giao dịch: Đã cập nhật ${txUtilitiesRes.modifiedCount} Utilities -> Housing & Bills.`);

    // ========================================================
    // 3. Backfill collection `installments`
    // ========================================================
    console.log('\n📅 [3/3] Đang backfill category cho collection `installments`...');
    const instFilter = {
        $or: [
            { category: { $exists: false } },
            { category: null },
            { category: '' }
        ]
    };
    const instRes = await Installment.updateMany(
        instFilter,
        { $set: { category: 'Housing & Bills' } }
    );
    console.log(`   - Khoản định kỳ: Đã bổ sung category 'Housing & Bills' cho ${instRes.modifiedCount} bản ghi legacy.`);

    console.log('\n🎉 Hoàn thành xuất sắc toàn bộ quá trình migration category!');
}

// Chạy trực tiếp từ CLI — không tự chạy nếu file này bị require() từ nơi khác.
if (require.main === module) {
    migrateBudgetCategories()
        .catch((error) => {
            console.error('❌ Migration thất bại:', error);
            process.exitCode = 1;
        })
        .finally(async () => {
            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
                console.log('🔌 Đã ngắt kết nối database an toàn.');
            }
        });
}

module.exports = { migrateBudgetCategories };
