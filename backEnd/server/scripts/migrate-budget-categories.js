'use strict';

/**
 * Đổi một danh mục legacy cho một user trong mỗi lần chạy.
 * Không xóa ngân sách, không đổi tháng/hạn mức/số tiền, không đoán danh mục thiếu.
 * Mặc định dry-run. Apply cần replica set/mongos và các unique index của schema.
 * Dừng ứng dụng/worker ghi dữ liệu và sao lưu trước khi apply.
 */
const mongoose = require('mongoose');
const { createHash } = require('node:crypto');

const RENAMES = new Map([
    ['Transport', 'Transportation'],
    ['Utilities', 'Housing & Bills']
]);
const MAX_RECORDS = 1000;
const QUERY_TIMEOUT_MS = 10000;
const VERSION = 'budget-category-v2';
const ENVIRONMENTS = new Set(['development', 'test', 'staging', 'production']);

class MigrationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MigrationError';
    }
}

function validateOptions({ mongoUri, expectedDb, userId, sourceCategory, apply, confirm }) {
    if (!ENVIRONMENTS.has(process.env.NODE_ENV)) {
        throw new MigrationError('Phải đặt NODE_ENV: development, test, staging hoặc production.');
    }
    if (typeof mongoUri !== 'string' || !/^mongodb(?:\+srv)?:\/\//.test(mongoUri)) {
        throw new MigrationError('Cần CATEGORY_MIGRATION_MONGODB_URI riêng cho migration.');
    }
    if (typeof expectedDb !== 'string' ||
        !/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/.test(expectedDb) ||
        ['admin', 'config', 'local'].includes(expectedDb.toLowerCase())) {
        throw new MigrationError('Cần tên database ứng dụng hợp lệ; không dùng database hệ thống.');
    }
    if (typeof userId !== 'string' || !/^[a-fA-F0-9]{24}$/.test(userId)) {
        throw new MigrationError('Cần một user ID dạng ObjectId 24 ký tự hex.');
    }
    if (!RENAMES.has(sourceCategory)) {
        throw new MigrationError('--source-category phải là Transport hoặc Utilities.');
    }
    if (typeof apply !== 'boolean') {
        throw new MigrationError('apply phải là boolean.');
    }
    if (apply && (typeof confirm !== 'string' || !confirm)) {
        throw new MigrationError('Chạy dry-run trước và truyền --confirm từ kết quả xem trước.');
    }
    if (!apply && confirm !== undefined) {
        throw new MigrationError('--confirm chỉ được dùng cùng --apply.');
    }
}

async function migrateBudgetCategories({
    mongoUri = process.env.CATEGORY_MIGRATION_MONGODB_URI,
    expectedDb,
    userId,
    sourceCategory,
    apply = false,
    confirm
} = {}) {
    validateOptions({ mongoUri, expectedDb, userId, sourceCategory, apply, confirm });
    const environment = process.env.NODE_ENV;
    const ownerId = new mongoose.Types.ObjectId(userId);
    const targetCategory = RENAMES.get(sourceCategory);
    const sourceLower = sourceCategory.toLowerCase();
    const targetLower = targetCategory.toLowerCase();
    const connection = mongoose.createConnection(mongoUri, {
        autoCreate: false, autoIndex: false, bufferCommands: false,
        serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000,
        socketTimeoutMS: 30000, maxPoolSize: 2
    });

    try {
        await connection.asPromise();
        if (connection.name !== expectedDb) {
            throw new MigrationError('Database trong URI không khớp --database; đã dừng.');
        }
        const db = connection.db;

        async function inspect(session) {
            const options = { session, maxTimeMS: QUERY_TIMEOUT_MS };
            const user = await db.collection('users').findOne(
                { _id: ownerId }, { ...options, projection: { _id: 1, customCategories: 1 } }
            );
            if (!user) throw new MigrationError('User không tồn tại.');

            async function readOwned(collection, filter, projection) {
                const records = await db.collection(collection).find({
                    ...filter, userId: ownerId
                }, { ...options, projection: { ...projection, _id: 1, userId: 1 } })
                    .sort({ _id: 1 }).limit(MAX_RECORDS + 1).toArray();
                if (records.length > MAX_RECORDS) {
                    throw new MigrationError('Vượt giới hạn 1000 bản ghi mỗi collection; cần kế hoạch chia lô riêng.');
                }
                if (records.some(record => !(record.userId instanceof mongoose.Types.ObjectId) ||
                    !record.userId.equals(ownerId) || !(record._id instanceof mongoose.Types.ObjectId))) {
                    throw new MigrationError('Có bản ghi sai kiểu ID/chủ sở hữu; cần đối soát riêng.');
                }
                return records;
            }

            const budgets = await readOwned('budgets', {
                category: { $in: [sourceCategory, targetCategory] }
            }, { category: 1, month: 1 });
            const transactions = await readOwned('transactions', {
                category: sourceCategory
            }, { category: 1 });
            const installments = await readOwned('installments', {
                $or: [{ category: sourceCategory }, { category: null }, { category: '' }]
            }, { category: 1 });
            const categories = await readOwned('categories', {
                $or: [
                    { nameLower: { $in: [sourceLower, targetLower] } },
                    { name: { $in: [sourceCategory, targetCategory] } }
                ]
            }, { name: 1, nameLower: 1 });

            const updates = [];
            const usedMonths = new Set();
            for (const budget of budgets) {
                if (![sourceCategory, targetCategory].includes(budget.category) ||
                    typeof budget.month !== 'string' ||
                    !(budget.month === 'global' || /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(budget.month))) {
                    throw new MigrationError('Ngân sách có danh mục/tháng không hợp lệ; không tự đoán month=global.');
                }
                // Sau đổi tên, cả nguồn và đích sẽ dùng cùng category trong từng tháng.
                if (usedMonths.has(budget.month)) {
                    throw new MigrationError('Xung đột ngân sách trong cùng tháng; không xóa hoặc gộp hạn mức.');
                }
                usedMonths.add(budget.month);
                if (budget.category === sourceCategory) {
                    updates.push({
                        collection: 'budgets', id: budget._id,
                        before: { category: sourceCategory, month: budget.month },
                        after: { category: targetCategory }
                    });
                }
            }
            for (const record of transactions) {
                if (record.category !== sourceCategory) {
                    throw new MigrationError('Giao dịch có category sai kiểu; đã dừng.');
                }
                updates.push({
                    collection: 'transactions', id: record._id,
                    before: { category: sourceCategory }, after: { category: targetCategory }
                });
            }
            const unclassifiedInstallments = [];
            for (const record of installments) {
                if (record.category === sourceCategory) {
                    updates.push({
                        collection: 'installments', id: record._id,
                        before: { category: sourceCategory }, after: { category: targetCategory }
                    });
                } else if (record.category == null || record.category === '') {
                    unclassifiedInstallments.push(record._id.toHexString());
                } else {
                    throw new MigrationError('Khoản định kỳ có category sai kiểu; đã dừng.');
                }
            }

            const byName = new Map();
            for (const category of categories) {
                if (typeof category.name !== 'string' ||
                    category.name.trim() !== category.name ||
                    typeof category.nameLower !== 'string' ||
                    category.name.toLowerCase() !== category.nameLower ||
                    ![sourceLower, targetLower].includes(category.nameLower) ||
                    byName.has(category.nameLower)) {
                    throw new MigrationError('Danh mục bị trùng hoặc sai cấu trúc; cần đối soát riêng.');
                }
                byName.set(category.nameLower, category);
            }
            const source = byName.get(sourceLower);
            const target = byName.get(targetLower);
            if (source && target) {
                throw new MigrationError('Danh sách danh mục có cả nguồn và đích; cần quyết định gộp riêng, không tự xóa.');
            }
            if (source && source.name !== sourceCategory) {
                throw new MigrationError('Tên danh mục nguồn khác cách viết chuẩn; cần đối soát trước khi đổi.');
            }
            if (target && target.name !== targetCategory) {
                throw new MigrationError('Tên danh mục đích khác cách viết chuẩn; cần đối soát trước khi đổi.');
            }

            const custom = user.customCategories == null ? [] : user.customCategories;
            if (!Array.isArray(custom) || custom.length > MAX_RECORDS ||
                custom.some(name => typeof name !== 'string' || !name || name.trim() !== name)) {
                throw new MigrationError('customCategories sai cấu trúc hoặc vượt giới hạn.');
            }
            let nextCustom = null;
            if (custom.includes(sourceCategory)) {
                if (custom.some(name => name.toLowerCase() === targetLower && name !== targetCategory)) {
                    throw new MigrationError('Danh mục tùy chỉnh có tên đích khác cách viết chuẩn.');
                }
                nextCustom = custom.map(name => name === sourceCategory ? targetCategory : name)
                    .filter((name, index, names) => name !== targetCategory || names.indexOf(name) === index);
            }
            if (source) {
                updates.push({
                    collection: 'categories', id: source._id,
                    before: { name: source.name, nameLower: source.nameLower },
                    after: { name: targetCategory, nameLower: targetLower }
                });
            }
            const insertCategory = !source && !target && (updates.length > 0 || nextCustom !== null);
            const plan = {
                updates,
                insertCategory,
                customBefore: nextCustom === null ? null : custom,
                customAfter: nextCustom,
                unclassifiedInstallments
            };
            const digest = createHash('sha256').update(JSON.stringify({
                version: VERSION, environment, database: expectedDb,
                userId: ownerId.toHexString(), sourceCategory, targetCategory, plan
            })).digest('hex');
            return { plan, confirmation: 'CATEGORY:' + expectedDb + ':' + digest };
        }

        function report(mode, inspected) {
            const { plan } = inspected;
            return {
                mode, database: expectedDb, userId: ownerId.toHexString(),
                sourceCategory, targetCategory,
                changes: plan.updates.map(item => ({
                    collection: item.collection, id: item.id.toHexString(),
                    before: item.before, after: item.after
                })),
                insertCategory: plan.insertCategory,
                updateCustomCategories: plan.customAfter !== null,
                unclassifiedInstallments: plan.unclassifiedInstallments
            };
        }

        if (!apply) {
            const inspected = await inspect();
            return { ...report('dry-run', inspected), confirmation: inspected.confirmation };
        }

        const topology = await db.admin().command({ hello: 1 }, { maxTimeMS: QUERY_TIMEOUT_MS });
        if (!topology.setName && topology.msg !== 'isdbgrid') {
            throw new MigrationError('Cần replica set hoặc mongos; không fallback standalone.');
        }
        // Không tạo/xóa index ngầm. Index phải được triển khai trước theo schema.
        for (const [collection, keys] of [
            ['budgets', ['userId', 'month', 'category']],
            ['categories', ['userId', 'nameLower']]
        ]) {
            let indexes;
            try {
                indexes = await db.collection(collection).listIndexes({ maxTimeMS: QUERY_TIMEOUT_MS }).toArray();
            } catch (error) {
                if (error.code === 26) throw new MigrationError('Thiếu collection/index bắt buộc; triển khai index theo schema trước.');
                throw error;
            }
            if (!indexes.some(index => index.unique === true && !index.sparse &&
                !index.partialFilterExpression && Object.keys(index.key).length === keys.length &&
                keys.every(key => index.key[key] === 1))) {
                throw new MigrationError('Thiếu unique index đầy đủ của Budget/Category; đã dừng.');
            }
        }

        return await connection.transaction(async session => {
            const inspected = await inspect(session);
            if (confirm !== inspected.confirmation) {
                throw new MigrationError('Confirmation không khớp kế hoạch hiện tại; chạy lại dry-run và đối soát.');
            }
            const { plan } = inspected;
            const options = { session, maxTimeMS: QUERY_TIMEOUT_MS };
            for (const item of plan.updates) {
                const result = await db.collection(item.collection).updateOne({
                    _id: item.id, userId: ownerId, ...item.before
                }, { $set: item.after }, options);
                if (!result.acknowledged || result.matchedCount !== 1 || result.modifiedCount !== 1) {
                    throw new MigrationError('Số bản ghi cập nhật không khớp; hủy toàn bộ transaction.');
                }
            }
            if (plan.insertCategory) {
                const result = await db.collection('categories').insertOne({
                    userId: ownerId, name: targetCategory, nameLower: targetLower, createdAt: new Date()
                }, options);
                if (!result.acknowledged) throw new MigrationError('Không xác nhận được việc tạo danh mục.');
            }
            if (plan.customAfter !== null) {
                const result = await db.collection('users').updateOne({
                    _id: ownerId, customCategories: plan.customBefore
                }, { $set: { customCategories: plan.customAfter } }, options);
                if (!result.acknowledged || result.matchedCount !== 1 || result.modifiedCount !== 1) {
                    throw new MigrationError('Danh mục tùy chỉnh không còn khớp; hủy toàn bộ transaction.');
                }
            }
            return report('applied', inspected);
        }, {
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority', wtimeout: 10000 },
            readPreference: 'primary', maxCommitTimeMS: 10000
        });
    } finally {
        await connection.close().catch(() => {
            console.error('Cảnh báo: không thể xác nhận kết nối migration đã đóng.');
        });
    }
}

function parseArgs(args) {
    const options = { apply: false };
    const flags = new Map([
        ['--database', 'expectedDb'], ['--user-id', 'userId'],
        ['--source-category', 'sourceCategory'], ['--confirm', 'confirm']
    ]);
    const seen = new Set();
    for (let i = 0; i < args.length; i += 1) {
        const flag = args[i];
        if ((!flags.has(flag) && flag !== '--apply' && flag !== '--dry-run') || seen.has(flag)) {
            throw new MigrationError('Tham số không hợp lệ hoặc bị lặp. Dùng --help.');
        }
        seen.add(flag);
        if (flag === '--apply') {
            options.apply = true;
        } else if (flags.has(flag)) {
            const value = args[++i];
            if (!value || value.startsWith('--')) throw new MigrationError('Thiếu giá trị cho tham số.');
            options[flags.get(flag)] = value;
        }
    }
    if (seen.has('--apply') && seen.has('--dry-run')) {
        throw new MigrationError('Không dùng --apply và --dry-run cùng lúc.');
    }
    return options;
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--help') {
        console.log([
            'Đổi Transport -> Transportation hoặc Utilities -> Housing & Bills cho một user.',
            'Đặt NODE_ENV và CATEGORY_MIGRATION_MONGODB_URI qua môi trường; không tự đọc .env.',
            'Không truyền URI/credential trên dòng lệnh.',
            'Xem trước: node scripts/migrate-budget-categories.js --database <database> --user-id <ObjectId> --source-category Transport',
            'Thực thi: giữ nguyên cấu hình, thêm --apply --confirm <confirmation từ dry-run>.',
            'Apply cần replica set/mongos và unique index của Budget/Category theo schema.',
            'Sao lưu và dừng ứng dụng/worker ghi dữ liệu trước khi apply.',
            'Confirmation gắn với môi trường/database/user/phép đổi/kế hoạch; không xác định máy chủ.',
            'Kiểm tra URI trỏ đúng máy chủ. Kế hoạch thay đổi phải được xem trước lại.',
            'Không xóa/gộp ngân sách; giữ nguyên month, limit và số tiền giao dịch.',
            'unclassifiedInstallments là các khoản thiếu danh mục được giữ nguyên để phân loại riêng.',
            'Đồng bộ Category/customCategories; xung đột cần đối soát, không tự xóa.',
            'Sau khi apply, muốn chạy lại phải lấy confirmation mới từ dry-run.'
        ].join('\n'));
        return;
    }
    console.log(JSON.stringify(await migrateBudgetCategories(parseArgs(args)), null, 2));
}

if (require.main === module) {
    main().catch(error => {
        process.exitCode = 1;
        console.error(error instanceof MigrationError
            ? error.message
            : 'Migration không xác nhận thành công. Đối soát database trước khi chạy lại; chi tiết lỗi nhạy cảm không được in ra.');
    });
}

module.exports = { migrateBudgetCategories };
