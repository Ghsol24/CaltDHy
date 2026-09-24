'use strict';

/**
 * Bổ sung Category từ dữ liệu của một user; không sửa/xóa dữ liệu nguồn.
 * Ưu tiên cách viết: customCategories, budgets, installments, transactions.
 * Mặc định dry-run; không tự nạp .env hoặc dùng connection của ứng dụng.
 * Apply cần unique index theo schema, replica set/mongos và cửa sổ bảo trì.
 */
const mongoose = require('mongoose');
const { createHash } = require('node:crypto');

const VERSION = 'category-collection-v2';
const MAX_RECORDS = 1000;
const MAX_NAME_LENGTH = 200;
const QUERY_TIMEOUT_MS = 10000;
const ENVIRONMENTS = new Set(['development', 'test', 'staging', 'production']);

class MigrationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MigrationError';
    }
}

function validateOptions({ mongoUri, expectedDb, userId, apply, confirm }) {
    if (!ENVIRONMENTS.has(process.env.NODE_ENV)) {
        throw new MigrationError('Phải đặt NODE_ENV: development, test, staging hoặc production.');
    }
    if (typeof mongoUri !== 'string' || !/^mongodb(?:\+srv)?:\/\//.test(mongoUri)) {
        throw new MigrationError('Cần CATEGORY_COLLECTION_MONGODB_URI riêng cho migration.');
    }
    if (typeof expectedDb !== 'string' ||
        !/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/.test(expectedDb) ||
        ['admin', 'config', 'local'].includes(expectedDb.toLowerCase())) {
        throw new MigrationError('Cần tên database ứng dụng hợp lệ; không dùng database hệ thống.');
    }
    if (typeof userId !== 'string' || !/^[a-fA-F0-9]{24}$/.test(userId)) {
        throw new MigrationError('Cần một user ID dạng ObjectId 24 ký tự hex.');
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

function normalizeName(value) {
    if (value == null) return null;
    if (typeof value !== 'string' || value.length > MAX_NAME_LENGTH) {
        throw new MigrationError('Tên danh mục sai kiểu hoặc vượt 200 ký tự; cần đối soát riêng.');
    }
    const name = value.trim();
    return name ? { name, nameLower: name.toLowerCase() } : null;
}

async function runCategoryMigration({
    mongoUri = process.env.CATEGORY_COLLECTION_MONGODB_URI,
    expectedDb,
    userId,
    apply = false,
    confirm
} = {}) {
    validateOptions({ mongoUri, expectedDb, userId, apply, confirm });
    const environment = process.env.NODE_ENV;
    const ownerId = new mongoose.Types.ObjectId(userId);
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
        const categories = db.collection('categories');

        async function inspect(session) {
            const options = { session, maxTimeMS: QUERY_TIMEOUT_MS };
            const user = await db.collection('users').findOne(
                { _id: ownerId }, { ...options, projection: { _id: 1, customCategories: 1 } }
            );
            if (!user) throw new MigrationError('User không tồn tại.');
            const custom = user.customCategories == null ? [] : user.customCategories;
            if (!Array.isArray(custom) || custom.length > MAX_RECORDS) {
                throw new MigrationError('customCategories phải là mảng tối đa 1000 phần tử.');
            }

            async function readOwned(collection, projection) {
                const records = await db.collection(collection).find({
                    userId: ownerId
                }, { ...options, projection: { ...projection, _id: 1, userId: 1 } })
                    .sort({ _id: 1 }).limit(MAX_RECORDS + 1).toArray();
                if (records.length > MAX_RECORDS) {
                    throw new MigrationError('Vượt 1000 bản ghi mỗi collection; cần kế hoạch chia lô riêng.');
                }
                if (records.some(record => !(record._id instanceof mongoose.Types.ObjectId) ||
                    !(record.userId instanceof mongoose.Types.ObjectId) || !record.userId.equals(ownerId))) {
                    throw new MigrationError('Có bản ghi sai kiểu ID/chủ sở hữu; cần đối soát riêng.');
                }
                return records;
            }

            const found = new Map();
            const sourceCounts = {};
            const skippedEmpty = {};
            function collect(source, values) {
                sourceCounts[source] = values.length;
                skippedEmpty[source] = 0;
                for (const value of values) {
                    const category = normalizeName(value);
                    if (!category) {
                        skippedEmpty[source] += 1;
                    } else if (!found.has(category.nameLower)) {
                        found.set(category.nameLower, category);
                    }
                }
            }
            collect('customCategories', custom);
            // Tuần tự để dùng an toàn trong cùng MongoDB transaction.
            for (const collection of ['budgets', 'installments', 'transactions']) {
                const records = await readOwned(collection, { category: 1 });
                collect(collection, records.map(record => record.category));
            }
            if (found.size > MAX_RECORDS) {
                throw new MigrationError('Vượt 1000 danh mục duy nhất; cần đối soát và chia lô riêng.');
            }

            const existing = new Map();
            const documents = await readOwned('categories', { name: 1, nameLower: 1 });
            for (const document of documents) {
                const normalized = normalizeName(document.name);
                if (!normalized || document.name !== normalized.name ||
                    document.nameLower !== normalized.nameLower || existing.has(document.nameLower)) {
                    throw new MigrationError('Category hiện có bị trùng hoặc sai name/nameLower; không tự sửa hoặc bỏ qua.');
                }
                existing.set(document.nameLower, {
                    id: document._id.toHexString(), name: document.name, nameLower: document.nameLower
                });
            }
            const compareNames = (a, b) => a.nameLower < b.nameLower ? -1 : a.nameLower > b.nameLower ? 1 : 0;
            const discovered = [...found.values()].sort(compareNames);
            const toCreate = discovered.filter(category => !existing.has(category.nameLower));
            const plan = {
                discovered,
                existing: [...existing.values()].sort(compareNames),
                toCreate,
                sourceCounts,
                skippedEmpty
            };
            const digest = createHash('sha256').update(JSON.stringify({
                version: VERSION, environment, database: expectedDb,
                userId: ownerId.toHexString(), plan
            })).digest('hex');
            return { plan, confirmation: 'CATEGORY-COLLECTION:' + expectedDb + ':' + digest };
        }

        function report(mode, plan, createdCount) {
            return {
                mode, database: expectedDb, userId: ownerId.toHexString(),
                foundCount: plan.discovered.length,
                existingCount: plan.existing.length,
                matchedExistingCount: plan.discovered.length - plan.toCreate.length,
                plannedCreateCount: plan.toCreate.length,
                createdCount,
                categoriesToCreate: plan.toCreate,
                sourceCounts: plan.sourceCounts,
                skippedEmpty: plan.skippedEmpty
            };
        }

        if (!apply) {
            const inspected = await inspect();
            return {
                ...report('dry-run', inspected.plan, 0),
                confirmation: inspected.confirmation
            };
        }

        const topology = await db.admin().command({ hello: 1 }, { maxTimeMS: QUERY_TIMEOUT_MS });
        if (!topology.setName && topology.msg !== 'isdbgrid') {
            throw new MigrationError('Cần replica set hoặc mongos; không fallback standalone.');
        }
        // Index phải được triển khai trước; script không tạo/drop index hoặc collection.
        let indexes;
        try {
            indexes = await categories.listIndexes({ maxTimeMS: QUERY_TIMEOUT_MS }).toArray();
        } catch (error) {
            if (error.code === 26) {
                throw new MigrationError('Thiếu collection/index Category; triển khai unique index theo schema trước.');
            }
            throw error;
        }
        if (!indexes.some(index => index.unique === true && !index.sparse &&
            !index.partialFilterExpression && Object.keys(index.key).length === 2 &&
            index.key.userId === 1 && index.key.nameLower === 1)) {
            throw new MigrationError('Thiếu unique index đầy đủ trên userId/nameLower; đã dừng.');
        }

        return await connection.transaction(async session => {
            const inspected = await inspect(session);
            if (confirm !== inspected.confirmation) {
                throw new MigrationError('Confirmation không khớp kế hoạch hiện tại; chạy lại dry-run và đối soát.');
            }
            const { plan } = inspected;
            let createdCount = 0;
            if (plan.toCreate.length > 0) {
                const createdAt = new Date();
                const result = await categories.insertMany(
                    plan.toCreate.map(category => ({ userId: ownerId, ...category, createdAt })),
                    { session, ordered: true, maxTimeMS: QUERY_TIMEOUT_MS }
                );
                if (!result.acknowledged || result.insertedCount !== plan.toCreate.length) {
                    throw new MigrationError('Số danh mục đã ghi không khớp; hủy toàn bộ transaction.');
                }
                createdCount = result.insertedCount;
            }
            return report('applied', plan, createdCount);
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
        ['--database', 'expectedDb'], ['--user-id', 'userId'], ['--confirm', 'confirm']
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
            'Bổ sung Category cho một user từ customCategories/budgets/installments/transactions.',
            'Đặt NODE_ENV và CATEGORY_COLLECTION_MONGODB_URI qua môi trường; không tự đọc .env.',
            'Không truyền URI/credential trên dòng lệnh.',
            'Xem trước: node scripts/migrate-categories-to-collection.js --database <database> --user-id <ObjectId>',
            'Thực thi: giữ nguyên cấu hình, thêm --apply --confirm <confirmation từ dry-run>.',
            'Apply cần replica set/mongos và unique index đầy đủ trên userId/nameLower.',
            'Sao lưu, dừng ứng dụng/worker ghi dữ liệu và kiểm tra URI trỏ đúng máy chủ trước khi apply.',
            'Confirmation gắn với môi trường/database/user/kế hoạch, không xác định máy chủ.',
            'Ưu tiên cách viết từ customCategories rồi budgets, installments, transactions theo _id.',
            'Trim tên, khử trùng bằng lowercase; giữ nguyên Category có sẵn và dữ liệu nguồn.',
            'skippedEmpty báo số giá trị thiếu/null/rỗng; sai kiểu dữ liệu làm dừng cả lượt.',
            'Giới hạn: 1000 bản ghi mỗi collection, 1000 danh mục duy nhất, tên tối đa 200 ký tự.',
            'Không in email, mật khẩu hoặc URI. Danh sách tên danh mục trong preview cần được bảo vệ.',
            'Kế hoạch thay đổi hoặc chạy lại sau apply: lấy confirmation mới từ dry-run.'
        ].join('\n'));
        return;
    }
    console.log(JSON.stringify(await runCategoryMigration(parseArgs(args)), null, 2));
}

if (require.main === module) {
    main().catch(error => {
        process.exitCode = 1;
        console.error(error instanceof MigrationError
            ? error.message
            : 'Migration không xác nhận thành công. Đối soát database trước khi chạy lại; chi tiết lỗi nhạy cảm không được in ra.');
    });
}

module.exports = { runCategoryMigration };
