/**
 * Migration Script: migrate-categories-to-collection.js
 *
 * Mục tiêu:
 * - Chuẩn hóa Category thành collection riêng (Category.js).
 * - Backfill dữ liệu an toàn (Non-breaking): Với mỗi user, gom tất cả category
 *   đang tồn tại từ 4 nguồn:
 *     1. Transaction (distinct category)
 *     2. Budget (distinct category)
 *     3. Installment (distinct category)
 *     4. User.customCategories
 * - Loại bỏ trùng lặp (không phân biệt hoa thường / case-insensitive) cho từng user.
 * - Hỗ trợ chế độ --dry-run để kiểm tra trước khi ghi dữ liệu.
 *
 * Cách chạy:
 *   Dry-run (chỉ quét, không ghi DB):
 *     node scripts/migrate-categories-to-collection.js --dry-run
 *   Thực thi thật:
 *     node scripts/migrate-categories-to-collection.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Installment = require('../models/Installment');
const Category = require('../models/Category');

async function runCategoryMigration({ dryRun = false, mongoUri = null } = {}) {
    const uri = mongoUri || process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('Thiếu MONGODB_URI. Không thể kết nối cơ sở dữ liệu.');
    }

    const isExistingConnection = mongoose.connection.readyState === 1;
    if (!isExistingConnection) {
        console.log('🔄 Đang kết nối MongoDB...');
        await mongoose.connect(uri);
        console.log('✅ Đã kết nối cơ sở dữ liệu.');
    }

    console.log(`\n🚀 BẮT ĐẦU MIGRATION CATEGORY COLLECTION ${dryRun ? '[CHẾ ĐỘ DRY-RUN]' : '[CHẾ ĐỘ THỰC THI]'}\n`);

    const users = await User.find({}).select('_id email name customCategories');
    console.log(`Tìm thấy tổng cộng ${users.length} người dùng cần xử lý.`);

    const report = {
        totalUsers: users.length,
        usersProcessed: 0,
        totalCategoriesCreated: 0,
        userDetails: []
    };

    for (const user of users) {
        const userId = user._id;

        // 1. Thu thập từ 4 nguồn
        const [txCats, budgetCats, installmentCats] = await Promise.all([
            Transaction.distinct('category', { userId, category: { $ne: null } }),
            Budget.distinct('category', { userId, category: { $ne: null } }),
            Installment.distinct('category', { userId, category: { $ne: null } })
        ]);

        const customCats = Array.isArray(user.customCategories) ? user.customCategories : [];

        // Gom tất cả và loại bỏ trùng lặp không phân biệt hoa thường
        const seenLower = new Set();
        const uniqueCategories = [];

        const allRawCategories = [...customCats, ...budgetCats, ...installmentCats, ...txCats];
        for (const raw of allRawCategories) {
            if (typeof raw !== 'string') continue;
            const trimmed = raw.trim();
            if (!trimmed) continue;
            const lower = trimmed.toLowerCase();
            if (!seenLower.has(lower)) {
                seenLower.add(lower);
                uniqueCategories.push(trimmed);
            }
        }

        // 2. Lấy các Category đã tồn tại trong collection Category của user
        const existingDocs = await Category.find({ userId });
        const existingLower = new Set(existingDocs.map(c => (c.nameLower || c.name.toLowerCase())));

        // 3. Xác định các Category cần tạo mới
        const categoriesToCreate = uniqueCategories.filter(name => !existingLower.has(name.toLowerCase()));

        if (!dryRun && categoriesToCreate.length > 0) {
            const docsToInsert = categoriesToCreate.map(name => ({
                userId,
                name,
                nameLower: name.toLowerCase(),
                createdAt: new Date()
            }));
            try {
                // ordered:false — 1 doc lỗi (vd trùng do chạy migration 2 lần) không chặn các doc còn lại
                await Category.insertMany(docsToInsert, { ordered: false });
            } catch (err) {
                // insertMany với ordered:false ném lỗi tổng hợp dù chỉ 1 vài doc lỗi — log rồi đi tiếp,
                // không để 1 user lỗi làm dừng migration của toàn bộ user còn lại.
                console.error(`   ⚠️  Một số category của user ${user.email} không insert được:`, err.message);
            }
        }

        report.totalCategoriesCreated += categoriesToCreate.length;
        report.usersProcessed++;

        const userDetail = {
            userId: userId.toString(),
            email: user.email,
            foundCount: uniqueCategories.length,
            alreadyExistingCount: existingDocs.length,
            createdCount: categoriesToCreate.length,
            allCategories: uniqueCategories,
            createdCategories: categoriesToCreate
        };
        report.userDetails.push(userDetail);

        console.log(`👤 User: ${user.email} (${userId})`);
        console.log(`   - Tổng category phát hiện: ${uniqueCategories.length}`);
        console.log(`   - Đã có sẵn: ${existingDocs.length}`);
        console.log(`   - ${dryRun ? 'Sẽ tạo mới (dry-run)' : 'Đã tạo mới'}: ${categoriesToCreate.length} [${categoriesToCreate.join(', ')}]`);
    }

    console.log('\n========================================================');
    console.log(`🎉 MIGRATION HOÀN TẤT ${dryRun ? '[DRY-RUN]' : ''}`);
    console.log(`   - Người dùng đã duyệt: ${report.usersProcessed}/${report.totalUsers}`);
    console.log(`   - Tổng category ${dryRun ? 'dự kiến tạo' : 'đã tạo mới'}: ${report.totalCategoriesCreated}`);
    console.log('========================================================\n');

    if (!isExistingConnection) {
        await mongoose.disconnect();
    }

    return report;
}

// Chạy trực tiếp từ CLI
if (require.main === module) {
    const isDryRun = process.argv.includes('--dry-run');
    runCategoryMigration({ dryRun: isDryRun })
        .then(() => process.exit(0))
        .catch(err => {
            console.error('❌ Lỗi Migration:', err);
            process.exit(1);
        });
}

module.exports = { runCategoryMigration };
