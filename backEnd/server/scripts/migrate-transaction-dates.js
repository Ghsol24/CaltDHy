'use strict';

/**
 * Chuyển date dạng YYYY-MM-DD sang BSON Date tại 00:00 UTC của cùng ngày.
 * Đây là mốc biểu diễn ngày của ứng dụng, không phải thời điểm phát sinh thực.
 * Chỉ xử lý một user và các transaction ID chỉ định; mặc định dry-run.
 * Không tự nạp .env, không dùng connection của ứng dụng, không sửa dữ liệu tiền.
 */
const mongoose = require('mongoose');
const { createHash } = require('node:crypto');

const VERSION = 'transaction-dates-v2';
const MAX_TRANSACTIONS = 100;
const QUERY_TIMEOUT_MS = 10000;
const ENVIRONMENTS = new Set(['development', 'test', 'staging', 'production']);

class MigrationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MigrationError';
    }
}

function parseIsoDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(value + 'T00:00:00.000Z');
    // Round-trip để từ chối ngày JavaScript tự cuộn sang tháng khác.
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function validateOptions({ mongoUri, expectedDb, userId, transactionIds, apply, confirm }) {
    if (!ENVIRONMENTS.has(process.env.NODE_ENV)) {
        throw new MigrationError('Phải đặt NODE_ENV: development, test, staging hoặc production.');
    }
    if (typeof mongoUri !== 'string' || !/^mongodb(?:\+srv)?:\/\//.test(mongoUri)) {
        throw new MigrationError('Cần DATE_MIGRATION_MONGODB_URI riêng cho migration.');
    }
    if (typeof expectedDb !== 'string' ||
        !/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/.test(expectedDb) ||
        ['admin', 'config', 'local'].includes(expectedDb.toLowerCase())) {
        throw new MigrationError('Cần tên database ứng dụng hợp lệ; không dùng database hệ thống.');
    }
    const isId = value => typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);
    if (!isId(userId)) {
        throw new MigrationError('Cần một user ID dạng ObjectId 24 ký tự hex.');
    }
    if (!Array.isArray(transactionIds) || transactionIds.length === 0 ||
        transactionIds.length > MAX_TRANSACTIONS || transactionIds.some(id => !isId(id))) {
        throw new MigrationError('Phải chỉ định từ 1 đến 100 transaction ID hợp lệ.');
    }
    const ids = transactionIds.map(id => id.toLowerCase()).sort();
    if (new Set(ids).size !== ids.length) {
        throw new MigrationError('Danh sách transaction ID bị trùng.');
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
    return ids;
}

async function migrate({
    mongoUri = process.env.DATE_MIGRATION_MONGODB_URI,
    expectedDb,
    userId,
    transactionIds,
    apply = false,
    confirm
} = {}) {
    const ids = validateOptions({ mongoUri, expectedDb, userId, transactionIds, apply, confirm });
    const environment = process.env.NODE_ENV;
    const ownerId = new mongoose.Types.ObjectId(userId);
    const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));
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
        const transactions = db.collection('transactions');

        async function inspect(session) {
            const options = { session, maxTimeMS: QUERY_TIMEOUT_MS };
            const owner = await db.collection('users').findOne(
                { _id: ownerId }, { ...options, projection: { _id: 1 } }
            );
            if (!owner) throw new MigrationError('User không tồn tại.');
            // Đọc native để Mongoose không tự cast String thành Date trước khi kiểm tra.
            const records = await transactions.find({
                _id: { $in: objectIds }, userId: ownerId
            }, { ...options, projection: { _id: 1, userId: 1, date: 1 } })
                .sort({ _id: 1 }).toArray();
            if (records.length !== ids.length || records.some(record =>
                !(record.userId instanceof mongoose.Types.ObjectId) || !record.userId.equals(ownerId))) {
                throw new MigrationError('Có giao dịch không tồn tại hoặc không thuộc user chỉ định.');
            }

            const plan = records.map(record => {
                const transactionId = record._id.toHexString();
                if (record.date instanceof Date && Number.isFinite(record.date.getTime())) {
                    const value = record.date.toISOString();
                    return { transactionId, action: 'unchanged', from: value, to: value };
                }
                const parsed = parseIsoDate(record.date);
                if (!parsed) {
                    throw new MigrationError('Có date không hợp lệ; chỉ nhận YYYY-MM-DD có thật hoặc BSON Date hợp lệ.');
                }
                return {
                    transactionId, action: 'convert',
                    from: record.date, to: parsed.toISOString()
                };
            });
            const digest = createHash('sha256').update(JSON.stringify({
                version: VERSION, environment, database: expectedDb,
                userId: ownerId.toHexString(), plan
            })).digest('hex');
            return { plan, confirmation: 'TRANSACTION-DATES:' + expectedDb + ':' + digest };
        }

        function report(mode, plan, modifiedCount) {
            return {
                mode, database: expectedDb, userId: ownerId.toHexString(),
                selectedCount: plan.length,
                plannedChangeCount: plan.filter(item => item.action === 'convert').length,
                alreadyDateCount: plan.filter(item => item.action === 'unchanged').length,
                modifiedCount,
                transactions: plan
            };
        }

        if (!apply) {
            const inspected = await inspect();
            return { ...report('dry-run', inspected.plan, 0), confirmation: inspected.confirmation };
        }

        const topology = await db.admin().command({ hello: 1 }, { maxTimeMS: QUERY_TIMEOUT_MS });
        if (!topology.setName && topology.msg !== 'isdbgrid') {
            throw new MigrationError('Cần replica set hoặc mongos; không fallback standalone.');
        }

        return await connection.transaction(async session => {
            const inspected = await inspect(session);
            if (confirm !== inspected.confirmation) {
                throw new MigrationError('Confirmation không khớp kế hoạch hiện tại; chạy lại dry-run và đối soát.');
            }
            let modifiedCount = 0;
            for (const item of inspected.plan) {
                if (item.action === 'unchanged') continue;
                const result = await transactions.updateOne({
                    _id: new mongoose.Types.ObjectId(item.transactionId),
                    userId: ownerId,
                    date: item.from
                }, { $set: { date: new Date(item.to) } }, { session, maxTimeMS: QUERY_TIMEOUT_MS });
                if (!result.acknowledged || result.matchedCount !== 1 || result.modifiedCount !== 1) {
                    throw new MigrationError('Số bản ghi cập nhật không khớp; hủy toàn bộ transaction.');
                }
                modifiedCount += 1;
            }
            return report('applied', inspected.plan, modifiedCount);
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
    const options = { transactionIds: [], apply: false };
    const flags = new Map([
        ['--database', 'expectedDb'], ['--user-id', 'userId'], ['--confirm', 'confirm']
    ]);
    const seen = new Set();
    for (let i = 0; i < args.length; i += 1) {
        const flag = args[i];
        if (!flags.has(flag) && !['--transaction-id', '--apply', '--dry-run'].includes(flag)) {
            throw new MigrationError('Tham số không hợp lệ. Dùng --help.');
        }
        if (flag !== '--transaction-id' && seen.has(flag)) {
            throw new MigrationError('Không được lặp lại tham số cấu hình.');
        }
        seen.add(flag);
        if (flag === '--apply') {
            options.apply = true;
        } else if (flag !== '--dry-run') {
            const value = args[++i];
            if (!value || value.startsWith('--')) throw new MigrationError('Thiếu giá trị cho tham số.');
            if (flag === '--transaction-id') options.transactionIds.push(value);
            else options[flags.get(flag)] = value;
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
            'Đổi date YYYY-MM-DD thành BSON Date tại 00:00 UTC của cùng ngày; mặc định dry-run.',
            'Đặt NODE_ENV và DATE_MIGRATION_MONGODB_URI qua môi trường; không tự đọc .env.',
            'Không truyền URI/credential trên dòng lệnh.',
            'Xem trước: node scripts/migrate-transaction-dates.js --database <database> --user-id <ObjectId> --transaction-id <ObjectId>',
            'Lặp --transaction-id để chọn tối đa 100 giao dịch của cùng một user.',
            'Thực thi: giữ nguyên cấu hình/IDs, thêm --apply --confirm <confirmation từ dry-run>.',
            'Apply cần replica set/mongos; sao lưu, dừng ứng dụng/worker ghi dữ liệu trước khi chạy.',
            'Confirmation gắn với môi trường/database/user/IDs/ngày dự kiến, không xác định máy chủ.',
            'Kiểm tra URI trỏ đúng máy chủ. Ngày thay đổi sau preview cần được đối soát lại.',
            'Giữ nguyên timestamp đã là BSON Date; không sửa giá trị thiếu/null hoặc chuỗi có giờ/múi giờ.',
            'Không sửa số tiền, ví, hũ hay danh mục. Không tạo collection/index.',
            'Chạy lại sau apply: lấy confirmation mới từ dry-run.'
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
