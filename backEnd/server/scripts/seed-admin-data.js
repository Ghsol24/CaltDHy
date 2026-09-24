'use strict';

/**
 * Chỉ tạo dữ liệu DEMO trong database development/test.
 * Không tự đọc .env; không cập nhật/xóa tài khoản hay dữ liệu có sẵn.
 * Giữ tên seedAdmin để tương thích; tài khoản được tạo KHÔNG có quyền admin.
 * Chỉ cấp credential MongoDB có quyền trên database thử nghiệm.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { createHash } = require('node:crypto');

const ALLOWED_DATABASES = new Set(['caltdhy_dev', 'caltdhy_test']);
const MODEL_NAMES = ['User', 'Wallet', 'Budget', 'Jar', 'Installment', 'Transaction', 'Category'];
const FIXTURE_VERSION = 'demo-2026-08-v2';
const QUERY_TIMEOUT_MS = 10000;

class SeedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SeedError';
    }
}

function validateOptions({ mongoUri, expectedDb, email, password, apply, confirm }) {
    if (!['development', 'test'].includes(process.env.NODE_ENV)) {
        throw new SeedError('Chỉ cho phép NODE_ENV=development hoặc test.');
    }
    if (typeof mongoUri !== 'string' || !/^mongodb(?:\+srv)?:\/\//.test(mongoUri)) {
        throw new SeedError('Cần SEED_MONGODB_URI riêng cho database thử nghiệm.');
    }
    if (!ALLOWED_DATABASES.has(expectedDb)) {
        throw new SeedError('Database phải là caltdhy_dev hoặc caltdhy_test.');
    }
    if (typeof apply !== 'boolean') {
        throw new SeedError('apply phải là boolean.');
    }
    if (typeof email !== 'string' || email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        throw new SeedError('Cần SEED_EMAIL hợp lệ cho tài khoản thử nghiệm mới.');
    }
    const normalizedEmail = email.trim().toLowerCase();
    const digest = createHash('sha256').update(JSON.stringify({
        database: expectedDb, email: normalizedEmail, fixture: FIXTURE_VERSION
    })).digest('hex');
    const confirmation = 'SEED:' + expectedDb + ':' + digest;

    if (apply && confirm !== confirmation) {
        throw new SeedError('Chạy dry-run trước và truyền đúng --confirm từ kết quả xem trước.');
    }
    if (!apply && confirm !== undefined) {
        throw new SeedError('--confirm chỉ được dùng cùng --apply.');
    }
    // bcrypt chỉ xử lý tối đa 72 byte; không trim hay cắt ngắn mật khẩu.
    if (apply && (typeof password !== 'string' ||
        Array.from(password).length < 16 || Buffer.byteLength(password, 'utf8') > 72 ||
        password.trim().length === 0 || /[\u0000-\u001f\u007f]/.test(password))) {
        throw new SeedError('SEED_PASSWORD phải có ít nhất 16 ký tự, tối đa 72 byte và không chứa ký tự điều khiển.');
    }
    return { normalizedEmail, confirmation };
}

function buildFixtures(userId) {
    // Bộ dữ liệu cố định tháng 7–8/2026, tiền VND nguyên; không phải giao dịch thực.
    const wallets = [
        { name: 'Vietcombank', type: 'bank', icon: '🏦', color: '#078A59', initialBalance: 45000000, isDefault: true },
        { name: 'Tiền mặt', type: 'cash', icon: '💵', color: '#0891B2', initialBalance: 3500000 },
        { name: 'Techcombank Visa', type: 'credit', icon: '💳', color: '#DC2626', initialBalance: 0, creditLimit: 30000000 },
        { name: 'Ví MoMo', type: 'e-wallet', icon: '📱', color: '#EC4899', initialBalance: 2000000 }
    ].map(wallet => ({
        _id: new mongoose.Types.ObjectId(), userId,
        isDefault: false, isExcludedFromTotal: false, ...wallet
    }));
    const [bank, cash, credit, momo] = wallets;
    const budgets = [
        { category: 'Food & Dining', limit: 5000000 },
        { category: 'Shopping', limit: 3000000 },
        { category: 'Transportation', limit: 1500000 },
        { category: 'Housing & Bills', limit: 4500000 },
        { category: 'Entertainment', limit: 2000000 },
        { category: 'Health & Beauty', limit: 1200000 }
    ].map(budget => ({ userId, month: 'global', ...budget }));
    // Khởi tạo hũ rỗng, không tạo số dư thiếu giao dịch đối ứng.
    const jars = [
        { name: 'Quỹ Du lịch Nhật Bản', target: 35000000, targetDate: '2026-11-30', icon: '✈️', color: '#2563EB' },
        { name: 'Nâng cấp MacBook Pro', target: 45000000, targetDate: '2026-12-31', icon: '💻', color: '#078A59' },
        { name: 'Quỹ Dự phòng Khẩn cấp', target: 60000000, targetDate: null, icon: '🛡️', color: '#D97706' },
        { name: 'Quỹ Quà Tết & Gia đình', target: 15000000, targetDate: '2027-01-20', icon: '🎁', color: '#DC2626' }
    ].map(jar => ({ userId, current: 0, history: [], ...jar }));
    // Chưa thanh toán kỳ nào: totalPaid và history cùng bắt đầu rỗng.
    const installments = [
        { name: 'Tiền thuê căn hộ', amount: 4500000, nextDueDate: '2026-09-01', icon: '🏠', category: 'Housing & Bills' },
        { name: 'Trả góp iPhone 16 Pro', amount: 2150000, nextDueDate: '2026-08-28', icon: '📱', category: 'Shopping' },
        { name: 'Internet cáp quang FPT', amount: 330000, nextDueDate: '2026-08-30', icon: '🌐', category: 'Housing & Bills' },
        { name: 'Gói Netflix 4K Family', amount: 260000, nextDueDate: '2026-09-05', icon: '🎬', category: 'Entertainment' },
        { name: 'Thẻ tập Gym California', amount: 800000, nextDueDate: '2026-09-10', icon: '🏋️', category: 'Health & Beauty' }
    ].map(installment => ({
        userId, walletId: bank._id, cycle: 'monthly',
        active: true, totalPaid: 0, history: [], ...installment
    }));
    const transactions = [
        { type: 'income', category: 'Salary', amount: 35000000, date: '2026-08-05T08:30:00Z', walletId: bank._id, desc: 'Nhận lương tháng 7 (Công ty chuyển khoản)' },
        { type: 'income', category: 'Gift & Bonus', amount: 10000000, date: '2026-08-15T10:00:00Z', walletId: bank._id, desc: 'Thưởng vượt chỉ tiêu KPI Q3' },
        { type: 'income', category: 'Investment', amount: 3200000, date: '2026-08-18T14:20:00Z', walletId: bank._id, desc: 'Cổ tức chứng khoán Techcombank' },
        { type: 'expense', category: 'Food & Dining', amount: 820000, date: '2026-08-24T19:00:00Z', walletId: bank._id, desc: 'Ăn tối liên hoan BBQ Gogi House' },
        { type: 'expense', category: 'Food & Dining', amount: 55000, date: '2026-08-24T08:15:00Z', walletId: momo._id, desc: 'Cà phê sáng Highlands Coffee' },
        { type: 'expense', category: 'Food & Dining', amount: 1250000, date: '2026-08-23T16:30:00Z', walletId: bank._id, desc: 'Đi siêu thị WinMart cuối tuần' },
        { type: 'expense', category: 'Transportation', amount: 110000, date: '2026-08-22T09:00:00Z', walletId: cash._id, desc: 'Đổ xăng xe máy Shell' },
        { type: 'expense', category: 'Shopping', amount: 1850000, date: '2026-08-20T18:45:00Z', walletId: credit._id, desc: 'Mua quần áo Uniqlo & Zara' },
        { type: 'expense', category: 'Housing & Bills', amount: 1420000, date: '2026-08-18T11:00:00Z', walletId: bank._id, desc: 'Hóa đơn Điện & Nước tháng 8' },
        { type: 'expense', category: 'Entertainment', amount: 380000, date: '2026-08-14T20:00:00Z', walletId: momo._id, desc: 'Xem phim IMAX CGV & Combo bắp nước' },
        { type: 'expense', category: 'Health & Beauty', amount: 350000, date: '2026-08-10T15:00:00Z', walletId: cash._id, desc: 'Combo chăm sóc tóc & mặt 30Shine' },
        { type: 'expense', category: 'Food & Dining', amount: 145000, date: '2026-08-08T12:30:00Z', walletId: momo._id, desc: 'Đặt đồ ăn trưa ShopeeFood' },
        { type: 'transfer', category: 'Chuyển tiền', amount: 2000000, fee: 3300, date: '2026-08-06T10:00:00Z', walletId: bank._id, toWalletId: cash._id, desc: 'Rút tiền mặt tiêu vặt tại cây ATM' },
        { type: 'transfer', category: 'Chuyển tiền', amount: 1500000, fee: 0, date: '2026-08-03T09:00:00Z', walletId: bank._id, toWalletId: momo._id, desc: 'Nạp tiền ví MoMo để thanh toán online' },
        { type: 'income', category: 'Salary', amount: 35000000, date: '2026-07-05T08:30:00Z', walletId: bank._id, desc: 'Nhận lương tháng 6' },
        { type: 'income', category: 'Business', amount: 8500000, date: '2026-07-15T16:00:00Z', walletId: bank._id, desc: 'Dự án tư vấn ngoài giờ' },
        { type: 'expense', category: 'Housing & Bills', amount: 4500000, date: '2026-07-02T10:00:00Z', walletId: bank._id, desc: 'Tiền thuê căn hộ tháng 7' },
        { type: 'expense', category: 'Food & Dining', amount: 4200000, date: '2026-07-20T19:00:00Z', walletId: bank._id, desc: 'Tổng ăn uống & siêu thị tháng 7' },
        { type: 'expense', category: 'Shopping', amount: 2800000, date: '2026-07-25T14:00:00Z', walletId: bank._id, desc: 'Mua đồ gia dụng phòng khách' }
    ].map(transaction => ({ ...transaction, userId, date: new Date(transaction.date) }));
    const names = new Set([...budgets, ...installments, ...transactions].map(item => item.category));
    const categories = [...names].map(name => ({ userId, name, nameLower: name.toLowerCase() }));

    return { Wallet: wallets, Budget: budgets, Jar: jars, Installment: installments,
        Transaction: transactions, Category: categories };
}

async function seedAdmin({
    mongoUri = process.env.SEED_MONGODB_URI,
    expectedDb,
    email = process.env.SEED_EMAIL,
    password = process.env.SEED_PASSWORD,
    apply = false,
    confirm
} = {}) {
    const { normalizedEmail, confirmation } = validateOptions({
        mongoUri, expectedDb, email, password, apply, confirm
    });
    const connection = mongoose.createConnection(mongoUri, {
        autoCreate: false, autoIndex: false, bufferCommands: false,
        serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000,
        socketTimeoutMS: 30000, maxPoolSize: 2
    });

    try {
        await connection.asPromise();
        if (connection.name !== expectedDb) {
            throw new SeedError('Database trong URI không khớp --database; đã dừng.');
        }
        async function assertNewEmail(session) {
            const existing = await connection.db.collection('users').findOne(
                { email: normalizedEmail },
                { session, projection: { _id: 1 }, maxTimeMS: QUERY_TIMEOUT_MS }
            );
            if (existing) {
                throw new SeedError('Email đã tồn tại; không đổi mật khẩu hoặc ghi đè dữ liệu.');
            }
        }
        await assertNewEmail();
        const userId = new mongoose.Types.ObjectId();
        const fixtures = buildFixtures(userId);
        const counts = { User: 1 };
        for (const [name, documents] of Object.entries(fixtures)) {
            counts[name] = documents.length;
        }
        if (!apply) {
            return { mode: 'dry-run', database: expectedDb, fixture: FIXTURE_VERSION,
                counts, confirmation };
        }

        const topology = await connection.db.admin().command(
            { hello: 1 }, { maxTimeMS: QUERY_TIMEOUT_MS }
        );
        if (!topology.setName && topology.msg !== 'isdbgrid') {
            throw new SeedError('Cần replica set hoặc mongos; không fallback standalone.');
        }
        const hashedPassword = await bcrypt.hash(password, 12);
        const models = {};
        for (const name of MODEL_NAMES) {
            const sourceModel = require('../models/' + name);
            const schema = sourceModel.schema.clone();
            schema.set('autoCreate', false);
            schema.set('autoIndex', false);
            schema.set('bufferCommands', false);
            models[name] = connection.model(name, schema, sourceModel.collection.name);
        }

        // DDL ngoài transaction: có thể để lại collection/index rỗng nếu seed thất bại.
        // Không dùng syncIndexes vì không được phép xóa index đang có.
        for (const model of Object.values(models)) {
            await model.createCollection({ maxTimeMS: QUERY_TIMEOUT_MS });
            await model.createIndexes({ maxTimeMS: QUERY_TIMEOUT_MS });
        }
        const userIndexes = await models.User.collection.listIndexes().toArray();
        if (!userIndexes.some(index => index.unique === true &&
            index.key.email === 1 && Object.keys(index.key).length === 1 &&
            !index.partialFilterExpression && !index.sparse)) {
            throw new SeedError('Thiếu unique index đầy đủ trên email; đã dừng.');
        }

        return await connection.transaction(async session => {
            await assertNewEmail(session);
            await models.User.create([{
                _id: userId, name: 'CaltDHy Demo', email: normalizedEmail,
                password: hashedPassword, emailVerified: false
            }], { session });
            // Không Promise.all trong transaction; mọi insert dùng cùng session.
            for (const [name, documents] of Object.entries(fixtures)) {
                await models[name].insertMany(documents, { session, ordered: true });
            }
            return { mode: 'applied', database: expectedDb, fixture: FIXTURE_VERSION,
                userId: userId.toHexString(), counts };
        }, {
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority', wtimeout: 10000 },
            readPreference: 'primary', maxCommitTimeMS: 10000
        });
    } finally {
        await connection.close().catch(() => {
            console.error('Cảnh báo: không thể xác nhận kết nối seed đã đóng.');
        });
    }
}

function parseArgs(args) {
    const options = { apply: false };
    const seen = new Set();
    for (let i = 0; i < args.length; i += 1) {
        const flag = args[i];
        if (!['--database', '--confirm', '--apply', '--dry-run'].includes(flag) || seen.has(flag)) {
            throw new SeedError('Tham số không hợp lệ hoặc bị lặp. Dùng --help để xem hướng dẫn.');
        }
        seen.add(flag);
        if (flag === '--apply') {
            options.apply = true;
        } else if (flag !== '--dry-run') {
            const value = args[++i];
            if (!value || value.startsWith('--')) {
                throw new SeedError('Thiếu giá trị cho tham số.');
            }
            if (flag === '--database') options.expectedDb = value;
            if (flag === '--confirm') options.confirm = value;
        }
    }
    if (seen.has('--apply') && seen.has('--dry-run')) {
        throw new SeedError('Không dùng --apply và --dry-run cùng lúc.');
    }
    return options;
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--help') {
        console.log([
            'Seed chỉ dành cho database thử nghiệm; chỉ tạo tài khoản mới.',
            'Đặt NODE_ENV=development hoặc test, SEED_MONGODB_URI và SEED_EMAIL qua môi trường.',
            'Khi apply, cung cấp SEED_PASSWORD ngẫu nhiên: ít nhất 16 ký tự, tối đa 72 byte.',
            'Không truyền mật khẩu/URI trên dòng lệnh; script không tự đọc .env.',
            'Xem trước: node scripts/seed-admin-data.js --database caltdhy_test',
            'Thực thi: giữ nguyên cấu hình, thêm --apply --confirm <confirmation từ dry-run>.',
            'Apply cần replica set/mongos; không dùng trên production.',
            'Confirmation gắn với database/email/phiên bản fixture, không khóa snapshot.',
            'Tài khoản không có quyền admin và emailVerified=false.',
            'Nếu mất kết nối lúc commit, kiểm tra email trong DB trước khi chạy lại.'
        ].join('\n'));
        return;
    }
    console.log(JSON.stringify(await seedAdmin(parseArgs(args)), null, 2));
}

if (require.main === module) {
    main().catch(error => {
        process.exitCode = 1;
        console.error(error instanceof SeedError
            ? error.message
            : 'Seed không xác nhận thành công. Đối soát database trước khi chạy lại; chi tiết lỗi nhạy cảm không được in ra.');
    });
}

module.exports = { seedAdmin };
