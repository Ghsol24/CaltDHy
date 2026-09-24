'use strict';

/**
 * Chuẩn hóa emailVerified thiếu/null thành false cho user ID chỉ định.
 * Ngày tạo tài khoản không chứng minh quyền sở hữu email.
 * Không đặt emailVerified=true, không xóa token/expiry xác minh.
 * Không tự nạp .env; dùng credential riêng, giới hạn quyền theo database.
 */
const mongoose = require('mongoose');
const { createHash } = require('node:crypto');

const MAX_USERS = 100;
const QUERY_TIMEOUT_MS = 10000;
const MIGRATION_VERSION = 'email-unverified-v1';
const ALLOWED_ENVIRONMENTS = new Set(['development', 'test', 'staging', 'production']);
const SYSTEM_DATABASES = new Set(['admin', 'config', 'local']);

class MigrationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MigrationError';
    }
}

function validateOptions({ mongoUri, expectedDb, userIds, apply, confirm }) {
    if (!ALLOWED_ENVIRONMENTS.has(process.env.NODE_ENV)) {
        throw new MigrationError('Phải đặt NODE_ENV rõ ràng: development, test, staging hoặc production.');
    }
    if (typeof mongoUri !== 'string' || !/^mongodb(?:\+srv)?:\/\//.test(mongoUri)) {
        throw new MigrationError('Cần EMAIL_MIGRATION_MONGODB_URI riêng cho migration.');
    }
    if (typeof expectedDb !== 'string' ||
        !/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/.test(expectedDb) ||
        SYSTEM_DATABASES.has(expectedDb.toLowerCase())) {
        throw new MigrationError('Cần tên database ứng dụng hợp lệ; không dùng database hệ thống.');
    }
    if (typeof apply !== 'boolean') {
        throw new MigrationError('apply phải là boolean.');
    }
    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > MAX_USERS ||
        userIds.some(id => typeof id !== 'string' || !/^[a-fA-F0-9]{24}$/.test(id))) {
        throw new MigrationError('Phải chỉ định từ 1 đến 100 user ID dạng ObjectId 24 ký tự hex.');
    }
    const ids = userIds.map(id => id.toLowerCase()).sort();
    if (new Set(ids).size !== ids.length) {
        throw new MigrationError('Danh sách user ID bị trùng.');
    }
    const digest = createHash('sha256').update(JSON.stringify({
        migration: MIGRATION_VERSION,
        environment: process.env.NODE_ENV,
        database: expectedDb,
        userIds: ids
    })).digest('hex');
    const confirmation = 'UNVERIFIED:' + expectedDb + ':' + digest;
    if (apply && confirm !== confirmation) {
        throw new MigrationError('Chạy dry-run trước và truyền đúng --confirm từ kết quả xem trước.');
    }
    if (!apply && confirm !== undefined) {
        throw new MigrationError('--confirm chỉ được dùng cùng --apply.');
    }
    return { ids, confirmation };
}

async function migrateEmailVerified({
    mongoUri = process.env.EMAIL_MIGRATION_MONGODB_URI,
    expectedDb,
    userIds,
    apply = false,
    confirm
} = {}) {
    const { ids, confirmation } = validateOptions({
        mongoUri, expectedDb, userIds, apply, confirm
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
        // Native collection để đọc đúng dữ liệu gốc, không áp default của User schema.
        const users = connection.db.collection('users');
        const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));

        async function inspectUsers(session) {
            const documents = await users.find(
                { _id: { $in: objectIds } },
                { session, projection: { _id: 1, emailVerified: 1 }, maxTimeMS: QUERY_TIMEOUT_MS }
            ).toArray();
            if (documents.length !== ids.length) {
                throw new MigrationError('Có user ID không tồn tại; không thực hiện cập nhật.');
            }
            const targets = [];
            const counts = {
                selected: documents.length,
                alreadyVerified: 0,
                alreadyUnverified: 0,
                toInitialize: 0
            };
            for (const document of documents) {
                if (!Object.prototype.hasOwnProperty.call(document, 'emailVerified') ||
                    document.emailVerified === null) {
                    targets.push(document._id);
                } else if (document.emailVerified === true) {
                    counts.alreadyVerified += 1;
                } else if (document.emailVerified === false) {
                    counts.alreadyUnverified += 1;
                } else {
                    throw new MigrationError('Có emailVerified sai kiểu dữ liệu; cần kiểm tra riêng trước khi migration.');
                }
            }
            counts.toInitialize = targets.length;
            return { targets, counts };
        }

        if (!apply) {
            const { counts } = await inspectUsers();
            return { mode: 'dry-run', database: expectedDb, userIds: ids, counts, confirmation };
        }

        const topology = await connection.db.admin().command(
            { hello: 1 }, { maxTimeMS: QUERY_TIMEOUT_MS }
        );
        if (!topology.setName && topology.msg !== 'isdbgrid') {
            throw new MigrationError('Cần replica set hoặc mongos; không fallback standalone.');
        }

        return await connection.transaction(async session => {
            // Đọc lại trong transaction; không dùng snapshot cũ từ dry-run.
            const { targets, counts } = await inspectUsers(session);
            let modified = 0;
            if (targets.length > 0) {
                const result = await users.updateMany({
                    _id: { $in: targets },
                    $or: [
                        { emailVerified: { $exists: false } },
                        { emailVerified: { $type: 10 } }
                    ]
                }, {
                    $set: { emailVerified: false }
                }, { session, maxTimeMS: QUERY_TIMEOUT_MS });
                if (!result.acknowledged || result.matchedCount !== targets.length ||
                    result.modifiedCount !== targets.length) {
                    throw new MigrationError('Số bản ghi cập nhật không khớp; hủy transaction.');
                }
                modified = result.modifiedCount;
            }
            return { mode: 'applied', database: expectedDb, userIds: ids, counts, modified };
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
    const options = { userIds: [], apply: false };
    const seen = new Set();
    for (let i = 0; i < args.length; i += 1) {
        const flag = args[i];
        if (!['--database', '--user-id', '--confirm', '--apply', '--dry-run'].includes(flag)) {
            throw new MigrationError('Tham số không hợp lệ. Dùng --help để xem hướng dẫn.');
        }
        if (flag !== '--user-id' && seen.has(flag)) {
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
            if (flag === '--user-id') options.userIds.push(value);
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
            'Chuẩn hóa emailVerified thiếu/null thành false; không tự xác minh email.',
            'Đặt NODE_ENV và EMAIL_MIGRATION_MONGODB_URI qua môi trường; không tự đọc .env.',
            'Không truyền URI hoặc credential trên dòng lệnh.',
            'Xem trước: node scripts/migrate-email-verified.js --database <database> --user-id <ObjectId>',
            'Có thể lặp --user-id, tối đa 100 tài khoản. --dry-run là mặc định.',
            'Thực thi: giữ nguyên cấu hình và IDs, thêm --apply --confirm <confirmation từ dry-run>.',
            'Apply cần replica set/mongos và cập nhật trong một transaction.',
            'Confirmation gắn với môi trường/database/IDs/phiên bản; không khóa snapshot hay máy chủ.',
            'Kiểm tra URI trỏ đúng máy chủ và sao lưu database trước khi apply.',
            'Giữ nguyên true/false và token/expiry; không chứng nhận trạng thái true cũ là hợp lệ.',
            'Luồng đăng ký/đăng nhập và default của User schema cần được kiểm tra riêng.'
        ].join('\n'));
        return;
    }
    console.log(JSON.stringify(await migrateEmailVerified(parseArgs(args)), null, 2));
}

if (require.main === module) {
    main().catch(error => {
        process.exitCode = 1;
        console.error(error instanceof MigrationError
            ? error.message
            : 'Migration không xác nhận thành công. Đối soát database trước khi chạy lại; chi tiết lỗi nhạy cảm không được in ra.');
    });
}

module.exports = { migrateEmailVerified };
