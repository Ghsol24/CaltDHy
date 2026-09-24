'use strict';

/**
 * Xóa tài khoản THỬ NGHIỆM theo danh sách ID tường minh.
 * Không dùng để quản trị hoặc xóa tài khoản production.
 *
 * Chỉ đọc CLEANUP_MONGODB_URI từ môi trường; không tự nạp .env.
 * Mặc định xem trước. Dừng ứng dụng/worker ghi vào DB trước khi --apply.
 * Credential MongoDB chỉ nên có quyền trên database thử nghiệm.
 */
const mongoose = require('mongoose');
const { createHash } = require('node:crypto');

const ALLOWED_DATABASES = new Set(['caltdhy_dev', 'caltdhy_test']);
const COLLECTIONS = [
    'wallets', 'transactions', 'budgets', 'jars',
    'installments', 'categories', 'expectedhighspenddays', 'authsessions', 'idempotencyreceipts', 'moneylocks', 'users'
];
const MAX_USERS = 100;
const QUERY_TIMEOUT_MS = 10000;

class CleanupError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CleanupError';
    }
}

function validateOptions({ mongoUri, expectedDb, userIds, apply, confirm }) {
    if (!['development', 'test'].includes(process.env.NODE_ENV)) {
        throw new CleanupError('Chỉ cho phép NODE_ENV=development hoặc test.');
    }
    if (typeof mongoUri !== 'string' ||
        !/^mongodb(?:\+srv)?:\/\//.test(mongoUri)) {
        throw new CleanupError('Cần CLEANUP_MONGODB_URI riêng cho database thử nghiệm.');
    }
    if (!ALLOWED_DATABASES.has(expectedDb)) {
        throw new CleanupError('Database phải là caltdhy_dev hoặc caltdhy_test.');
    }
    if (typeof apply !== 'boolean') {
        throw new CleanupError('apply phải là boolean.');
    }
    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > MAX_USERS) {
        throw new CleanupError('Phải chỉ định từ 1 đến 100 user ID.');
    }
    if (userIds.some(id => typeof id !== 'string' || !/^[a-fA-F0-9]{24}$/.test(id))) {
        throw new CleanupError('Mỗi user ID phải là chuỗi ObjectId 24 ký tự hex.');
    }

    const ids = userIds.map(id => id.toLowerCase()).sort();
    if (new Set(ids).size !== ids.length) {
        throw new CleanupError('Danh sách user ID bị trùng.');
    }
    const digest = createHash('sha256')
        .update(JSON.stringify({ database: expectedDb, userIds: ids }))
        .digest('hex');
    const confirmation = 'DELETE:' + expectedDb + ':' + digest;

    if (apply && confirm !== confirmation) {
        throw new CleanupError('Chạy dry-run trước và truyền đúng --confirm từ kết quả xem trước.');
    }
    if (!apply && confirm !== undefined) {
        throw new CleanupError('--confirm chỉ được dùng cùng --apply.');
    }
    return { ids, confirmation };
}

async function cleanup({
    mongoUri = process.env.CLEANUP_MONGODB_URI,
    expectedDb,
    userIds,
    apply = false,
    confirm
} = {}) {
    const { ids, confirmation } = validateOptions({
        mongoUri, expectedDb, userIds, apply, confirm
    });

    // Connection riêng; không tạo collection/index trong dry-run.
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
            throw new CleanupError('Database trong URI không khớp --database; đã dừng.');
        }

        const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));
        const filterFor = name => name === 'users' || name === 'moneylocks'
            ? { _id: { $in: objectIds } }
            : { userId: { $in: objectIds } };

        async function countTargets(session) {
            const counts = {};
            for (const name of COLLECTIONS) {
                counts[name] = await connection.db.collection(name).countDocuments(
                    filterFor(name),
                    { session, maxTimeMS: QUERY_TIMEOUT_MS }
                );
            }
            if (counts.users !== ids.length) {
                throw new CleanupError('Có user ID không tồn tại; không thực hiện xóa.');
            }
            return counts;
        }

        if (!apply) {
            return {
                mode: 'dry-run',
                database: expectedDb,
                userIds: ids,
                counts: await countTargets(),
                confirmation
            };
        }

        const topology = await connection.db.admin().command(
            { hello: 1 }, { maxTimeMS: QUERY_TIMEOUT_MS }
        );
        if (!topology.setName && topology.msg !== 'isdbgrid') {
            throw new CleanupError('Cần replica set hoặc mongos; không fallback standalone.');
        }

        return await connection.transaction(async session => {
            const counts = await countTargets(session);
            const deleted = {};

            // Tuần tự trong cùng transaction; xóa User sau dữ liệu liên quan.
            for (const name of COLLECTIONS) {
                const result = await connection.db.collection(name).deleteMany(
                    filterFor(name),
                    { session, maxTimeMS: QUERY_TIMEOUT_MS }
                );
                if (!result.acknowledged || result.deletedCount !== counts[name]) {
                    throw new CleanupError('Số bản ghi xóa không khớp; hủy transaction.');
                }
                deleted[name] = result.deletedCount;
            }
            return { mode: 'applied', database: expectedDb, userIds: ids, deleted };
        }, {
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority', wtimeout: 10000 },
            readPreference: 'primary',
            maxCommitTimeMS: 10000
        });
    } finally {
        await connection.close().catch(() => {
            // Không che mất kết quả commit/lỗi chính, không log credential.
            console.error('Cảnh báo: không thể xác nhận kết nối cleanup đã đóng.');
        });
    }
}

function parseArgs(args) {
    const options = { userIds: [], apply: false };
    const seen = new Set();

    for (let i = 0; i < args.length; i += 1) {
        const flag = args[i];
        if (!['--database', '--user-id', '--confirm', '--apply', '--dry-run'].includes(flag)) {
            throw new CleanupError('Tham số không hợp lệ. Dùng --help để xem hướng dẫn.');
        }
        if (flag !== '--user-id' && seen.has(flag)) {
            throw new CleanupError('Không được lặp lại tham số cấu hình.');
        }
        seen.add(flag);

        if (flag === '--apply') {
            options.apply = true;
        } else if (flag !== '--dry-run') {
            const value = args[++i];
            if (!value || value.startsWith('--')) {
                throw new CleanupError('Thiếu giá trị cho tham số.');
            }
            if (flag === '--database') options.expectedDb = value;
            if (flag === '--user-id') options.userIds.push(value);
            if (flag === '--confirm') options.confirm = value;
        }
    }

    if (seen.has('--apply') && seen.has('--dry-run')) {
        throw new CleanupError('Không dùng --apply và --dry-run cùng lúc.');
    }
    return options;
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--help') {
        console.log([
            'Cleanup chỉ dành cho database thử nghiệm.',
            'Đặt NODE_ENV=development hoặc test và CLEANUP_MONGODB_URI qua môi trường.',
            'Không truyền credential trên dòng lệnh; script không tự đọc .env.',
            'Xem trước: node scripts/cleanup-users.js --database caltdhy_test --user-id <ObjectId>',
            'Có thể lặp --user-id, tối đa 100 tài khoản. --dry-run là mặc định.',
            'Thực thi: giữ nguyên database/IDs, thêm --apply --confirm <confirmation từ dry-run>.',
            'Trước khi thực thi: sao lưu và dừng ứng dụng/worker đang ghi vào database.',
            'Confirmation xác nhận database/IDs, không khóa snapshot của dry-run.',
            'Không dùng công cụ này trên production.'
        ].join('\n'));
        return;
    }
    const result = await cleanup(parseArgs(args));
    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
    main().catch(error => {
        process.exitCode = 1;
        console.error(error instanceof CleanupError
            ? error.message
            : 'Cleanup không xác nhận thành công. Đối soát database trước khi chạy lại; chi tiết lỗi nhạy cảm không được in ra.');
    });
}

module.exports = { cleanup };
