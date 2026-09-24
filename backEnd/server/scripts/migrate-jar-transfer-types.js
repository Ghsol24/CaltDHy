'use strict';

/**
 * Sửa giao dịch hũ legacy cho một user và danh sách transaction ID chỉ định.
 * Mặc định dry-run; không tự nạp .env và không dùng connection của ứng dụng.
 * Chỉ đổi cách phân loại/liên kết ví, không ghi lại số tiền hay số dư hũ.
 * Apply trong cửa sổ bảo trì: dừng ứng dụng/worker ghi dữ liệu và sao lưu DB.
 */
const mongoose = require('mongoose');
const { createHash } = require('node:crypto');

const MAX_TRANSACTIONS = 100;
const QUERY_TIMEOUT_MS = 10000;
const MIGRATION_VERSION = 'jar-transfer-v2';
const ENVIRONMENTS = new Set(['development', 'test', 'staging', 'production']);
const SYSTEM_DATABASES = new Set(['admin', 'config', 'local']);

class MigrationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MigrationError';
    }
}

function validateOptions({ mongoUri, expectedDb, userId, transactionIds, apply, confirm }) {
    if (!ENVIRONMENTS.has(process.env.NODE_ENV)) {
        throw new MigrationError('Phải đặt NODE_ENV: development, test, staging hoặc production.');
    }
    if (typeof mongoUri !== 'string' || !/^mongodb(?:\+srv)?:\/\//.test(mongoUri)) {
        throw new MigrationError('Cần JAR_MIGRATION_MONGODB_URI riêng cho migration.');
    }
    if (typeof expectedDb !== 'string' ||
        !/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/.test(expectedDb) ||
        SYSTEM_DATABASES.has(expectedDb.toLowerCase())) {
        throw new MigrationError('Cần tên database ứng dụng hợp lệ; không dùng database hệ thống.');
    }
    const isIdString = value => typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);
    if (!isIdString(userId)) {
        throw new MigrationError('Phải chỉ định một user ID dạng ObjectId 24 ký tự hex.');
    }
    if (!Array.isArray(transactionIds) || transactionIds.length === 0 ||
        transactionIds.length > MAX_TRANSACTIONS || transactionIds.some(id => !isIdString(id))) {
        throw new MigrationError('Phải chỉ định từ 1 đến 100 transaction ID hợp lệ.');
    }
    if (typeof apply !== 'boolean') {
        throw new MigrationError('apply phải là boolean.');
    }
    const ownerId = userId.toLowerCase();
    const ids = transactionIds.map(id => id.toLowerCase()).sort();
    if (new Set(ids).size !== ids.length) {
        throw new MigrationError('Danh sách transaction ID bị trùng.');
    }
    const digest = createHash('sha256').update(JSON.stringify({
        migration: MIGRATION_VERSION,
        environment: process.env.NODE_ENV,
        database: expectedDb,
        userId: ownerId,
        transactionIds: ids
    })).digest('hex');
    const confirmation = 'JAR-TRANSFER:' + expectedDb + ':' + digest;
    if (apply && confirm !== confirmation) {
        throw new MigrationError('Chạy dry-run trước và truyền đúng --confirm từ kết quả xem trước.');
    }
    if (!apply && confirm !== undefined) {
        throw new MigrationError('--confirm chỉ được dùng cùng --apply.');
    }
    return { ownerId, ids, confirmation };
}

function classifyRecord(record) {
    const isObjectId = value => value instanceof mongoose.Types.ObjectId;
    if (!isObjectId(record.jarId) || record.installmentId != null) {
        throw new MigrationError('Giao dịch thiếu jarId hợp lệ hoặc có liên kết installment; cần đối soát riêng.');
    }
    // Không làm tròn hoặc đoán đơn vị tiền khi sửa dữ liệu lịch sử.
    if (!Number.isSafeInteger(record.amount) || record.amount <= 0 ||
        (record.fee != null && record.fee !== 0)) {
        throw new MigrationError('Chỉ nhận số tiền nguyên dương an toàn và phí bằng 0/thiếu/null.');
    }
    const hasSource = isObjectId(record.walletId);
    const hasDestination = isObjectId(record.toWalletId);
    const sourceOnly = hasSource && record.toWalletId == null;
    const destinationOnly = hasDestination && record.walletId == null;

    if (record.type === 'expense' && record.category === 'Other Expense' && sourceOnly) {
        return { action: 'deposit', walletId: record.walletId };
    }
    if (record.type === 'income' && record.category === 'Other Income' && sourceOnly) {
        return { action: 'withdraw', walletId: record.walletId };
    }
    if (record.type === 'transfer' &&
        ((record.category === 'Chuyển vào hũ' && sourceOnly) ||
         (record.category === 'Chuyển từ hũ' && destinationOnly))) {
        return { action: 'unchanged', walletId: hasSource ? record.walletId : record.toWalletId };
    }
    throw new MigrationError('Loại, danh mục hoặc hướng ví không đúng mẫu giao dịch hũ; cần đối soát riêng.');
}

async function migrate({
    mongoUri = process.env.JAR_MIGRATION_MONGODB_URI,
    expectedDb,
    userId,
    transactionIds,
    apply = false,
    confirm
} = {}) {
    const { ownerId, ids, confirmation } = validateOptions({
        mongoUri, expectedDb, userId, transactionIds, apply, confirm
    });
    const connection = mongoose.createConnection(mongoUri, {
        autoCreate: false,
        autoIndex: false,
        bufferCommands: false,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 30000,
        maxPoolSize: 2
    });

    try {
        await connection.asPromise();
        if (connection.name !== expectedDb) {
            throw new MigrationError('Database trong URI không khớp --database; đã dừng.');
        }
        const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
        const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));
        const transactions = connection.db.collection('transactions');

        async function inspect(session) {
            const queryOptions = { session, maxTimeMS: QUERY_TIMEOUT_MS };
            const owner = await connection.db.collection('users').findOne(
                { _id: ownerObjectId }, { ...queryOptions, projection: { _id: 1 } }
            );
            if (!owner) {
                throw new MigrationError('User không tồn tại; không thực hiện migration.');
            }
            const records = await transactions.find({
                _id: { $in: objectIds }, userId: ownerObjectId
            }, {
                ...queryOptions,
                projection: {
                    _id: 1, userId: 1, type: 1, category: 1, amount: 1, fee: 1,
                    walletId: 1, toWalletId: 1, jarId: 1, installmentId: 1
                }
            }).sort({ _id: 1 }).toArray();
            if (records.length !== ids.length || records.some(record =>
                !(record.userId instanceof mongoose.Types.ObjectId) || !record.userId.equals(ownerObjectId))) {
                throw new MigrationError('Có giao dịch không tồn tại hoặc không thuộc user chỉ định.');
            }
            const planned = records.map(record => ({ record, ...classifyRecord(record) }));
            const walletIds = new Map();
            const jarIds = new Map();
            for (const item of planned) {
                walletIds.set(item.walletId.toHexString(), item.walletId);
                jarIds.set(item.record.jarId.toHexString(), item.record.jarId);
            }
            // Ví đã lưu trữ vẫn có lịch sử hợp lệ; kiểm tra chủ sở hữu, không lọc archived.
            for (const [collection, references] of [['wallets', walletIds], ['jars', jarIds]]) {
                const documents = await connection.db.collection(collection).find({
                    _id: { $in: [...references.values()] }, userId: ownerObjectId
                }, { ...queryOptions, projection: { _id: 1, userId: 1 } }).toArray();
                // MongoDB có thể match một ObjectId nằm trong mảng: chỉ chấp nhận owner dạng scalar.
                if (documents.length !== references.size || documents.some(document =>
                    !(document.userId instanceof mongoose.Types.ObjectId) || !document.userId.equals(ownerObjectId))) {
                    throw new MigrationError('Ví/hũ không tồn tại hoặc khác chủ sở hữu; hủy cả nhóm.');
                }
            }
            const counts = {
                selected: records.length,
                deposits: planned.filter(item => item.action === 'deposit').length,
                withdrawals: planned.filter(item => item.action === 'withdraw').length,
                alreadyMigrated: planned.filter(item => item.action === 'unchanged').length
            };
            return { planned, counts };
        }

        if (!apply) {
            const { planned, counts } = await inspect();
            return {
                mode: 'dry-run', database: expectedDb, userId: ownerId, counts,
                transactions: planned.map(item => ({
                    transactionId: item.record._id.toHexString(), action: item.action
                })),
                confirmation
            };
        }

        const topology = await connection.db.admin().command(
            { hello: 1 }, { maxTimeMS: QUERY_TIMEOUT_MS }
        );
        if (!topology.setName && topology.msg !== 'isdbgrid') {
            throw new MigrationError('Cần replica set hoặc mongos; không fallback standalone.');
        }
        return await connection.transaction(async session => {
            const { planned, counts } = await inspect(session);
            let modified = 0;
            for (const { record, action } of planned) {
                if (action === 'unchanged') continue;
                const changes = action === 'deposit'
                    ? { type: 'transfer', category: 'Chuyển vào hũ' }
                    : {
                        type: 'transfer', category: 'Chuyển từ hũ',
                        walletId: null, toWalletId: record.walletId
                    };
                const result = await transactions.updateOne({
                    _id: record._id,
                    userId: ownerObjectId,
                    jarId: record.jarId,
                    type: record.type,
                    category: record.category,
                    walletId: record.walletId,
                    toWalletId: null,
                    amount: record.amount
                }, { $set: changes }, { session, maxTimeMS: QUERY_TIMEOUT_MS });
                if (!result.acknowledged || result.matchedCount !== 1 || result.modifiedCount !== 1) {
                    throw new MigrationError('Giao dịch không còn khớp kế hoạch; hủy cả transaction.');
                }
                modified += 1;
            }
            return {
                mode: 'applied', database: expectedDb, userId: ownerId,
                transactionIds: ids, counts, modified
            };
        }, {
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority', wtimeout: 10000 },
            readPreference: 'primary',
            maxCommitTimeMS: 10000
        });
    } finally {
        await connection.close().catch(() => {
            console.error('Cảnh báo: không thể xác nhận kết nối migration đã đóng.');
        });
    }
}

function parseArgs(args) {
    const options = { transactionIds: [], apply: false };
    const seen = new Set();
    for (let i = 0; i < args.length; i += 1) {
        const flag = args[i];
        if (!['--database', '--user-id', '--transaction-id', '--confirm', '--apply', '--dry-run'].includes(flag)) {
            throw new MigrationError('Tham số không hợp lệ. Dùng --help để xem hướng dẫn.');
        }
        if (flag !== '--transaction-id' && seen.has(flag)) {
            throw new MigrationError('Không được lặp lại tham số cấu hình.');
        }
        seen.add(flag);
        if (flag === '--apply') {
            options.apply = true;
        } else if (flag !== '--dry-run') {
            const value = args[++i];
            if (!value || value.startsWith('--')) {
                throw new MigrationError('Thiếu giá trị cho tham số.');
            }
            if (flag === '--database') options.expectedDb = value;
            if (flag === '--user-id') options.userId = value;
            if (flag === '--transaction-id') options.transactionIds.push(value);
            if (flag === '--confirm') options.confirm = value;
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
            'Migration giao dịch hũ legacy; mặc định dry-run.',
            'Đặt NODE_ENV và JAR_MIGRATION_MONGODB_URI qua môi trường; không tự đọc .env.',
            'Không truyền URI hoặc credential trên dòng lệnh.',
            'Xem trước: node scripts/migrate-jar-transfer-types.js --database <database> --user-id <ObjectId> --transaction-id <ObjectId>',
            'Lặp --transaction-id để chọn tối đa 100 giao dịch của cùng một user.',
            'Thực thi: giữ nguyên cấu hình/IDs, thêm --apply --confirm <confirmation từ dry-run>.',
            'Apply cần replica set/mongos; sao lưu và dừng ứng dụng/worker ghi dữ liệu trước khi chạy.',
            'Confirmation gắn với môi trường/database/user/IDs/phiên bản, không khóa snapshot hay máy chủ.',
            'Kiểm tra URI trỏ đúng máy chủ; migration không chứng minh nguồn gốc giao dịch.',
            'Chỉ nhận mẫu legacy Other Expense/Other Income, số tiền nguyên dương, không có phí.',
            'Dữ liệu không rõ ràng phải đối soát riêng; script không làm tròn hoặc sửa số dư hũ.'
        ].join('\n'));
        return;
    }
    console.log(JSON.stringify(await migrate(parseArgs(args)), null, 2));
}

if (require.main === module) {
    main().catch(error => {
        process.exitCode = 1;
        console.error(error instanceof MigrationError
            ? error.message
            : 'Migration không xác nhận thành công. Đối soát database trước khi chạy lại; chi tiết lỗi nhạy cảm không được in ra.');
    });
}

module.exports = { migrate };
