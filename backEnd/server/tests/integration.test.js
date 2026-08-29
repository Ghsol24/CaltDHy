const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Thiết lập môi trường test độc lập TRƯỚC KHI load app
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_caltdhy_integration';

const app = require('../server');

describe('Backend Integration Test Suite (Real MongoDB & Real Middleware)', () => {
    let mongod;
    let token;
    let walletId;

    before(async () => {
        mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();
        await mongoose.connect(uri);
    });

    after(async () => {
        await mongoose.disconnect();
        if (mongod) {
            await mongod.stop();
        }
    });

    it('1. Đăng ký tài khoản mới qua POST /api/auth/register', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Integration Tester',
                email: 'tester_integration@caltdhy.test',
                password: 'Password123!'
            });

        assert.equal(res.status, 201);
        assert.equal(res.body.success, true);
        assert.ok(res.body.token);
    });

    it('2. Đăng nhập qua POST /api/auth/login', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'tester_integration@caltdhy.test',
                password: 'Password123!'
            });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.token);
        token = res.body.token;
    });

    it('3. Tạo ví mới qua POST /api/wallets', async () => {
        const res = await request(app)
            .post('/api/wallets')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Ví Chính Test',
                type: 'cash',
                icon: '💵',
                color: '#2ed573',
                initialBalance: 5000000
            });

        assert.equal(res.status, 201);
        assert.equal(res.body.success, true);
        assert.ok(res.body.data?.id || res.body.data?._id);
        walletId = res.body.data.id || res.body.data._id;
    });

    it('4. Tạo giao dịch mới qua POST /api/spending', async () => {
        const res = await request(app)
            .post('/api/spending')
            .set('Authorization', `Bearer ${token}`)
            .send({
                type: 'expense',
                desc: 'Ăn trưa test',
                amount: 65000,
                category: 'Ăn uống',
                date: '2026-08-27',
                walletId: walletId
            });

        assert.equal(res.status, 201);
        assert.equal(res.body.success, true);
        assert.equal(res.body.data?.amount, 65000);
    });

    it('5. Cập nhật profile kèm avatar > 100KB (bắt lỗi giới hạn body size)', async () => {
        // Chuỗi base64 ~150KB (> default 100KB của body-parser)
        const avatar150KB = 'data:image/png;base64,' + 'A'.repeat(150 * 1024);

        const res = await request(app)
            .put('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`)
            .send({
                avatar: avatar150KB
            });

        assert.equal(res.status, 200, `Kỳ vọng HTTP 200 nhưng nhận ${res.status}: ${JSON.stringify(res.body)}`);
        assert.equal(res.body.success, true);
        assert.ok(res.body.user?.avatar);
    });

    it('5b. Avatar ~1.7MB (giữa 1.5MB MAX_AVATAR_BYTES và 2MB body-parser limit) → phải bị app-level validate chặn với 400', async () => {
        // Vùng biên quan trọng nhất: dưới giới hạn body-parser (2MB) nhưng vượt MAX_AVATAR_BYTES (1.5MB).
        // Trước khi sửa limit body-parser, đoạn check MAX_AVATAR_BYTES trong auth.js gần như là dead code
        // vì mọi request >100KB đã bị body-parser chặn trước đó. Test này xác nhận nó thực sự chạy đúng.
        const avatar17MB = 'data:image/png;base64,' + 'A'.repeat(1.7 * 1024 * 1024);

        const res = await request(app)
            .put('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`)
            .send({ avatar: avatar17MB });

        assert.equal(res.status, 400, `Kỳ vọng HTTP 400 (app-level validate) nhưng nhận ${res.status}: ${JSON.stringify(res.body)}`);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /Kích thước ảnh quá lớn/);
    });

    it('5c. Avatar ~2.2MB (vượt 2MB body-parser limit) → phải bị chặn ở tầng middleware với 413', async () => {
        const avatar22MB = 'data:image/png;base64,' + 'A'.repeat(2.2 * 1024 * 1024);

        const res = await request(app)
            .put('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`)
            .send({ avatar: avatar22MB });

        assert.equal(res.status, 413, `Kỳ vọng HTTP 413 nhưng nhận ${res.status}: ${JSON.stringify(res.body)}`);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /Dung lượng yêu cầu quá lớn/);
    });

    it('6. Lấy số dư ví qua GET /api/wallets/balances', async () => {
        const res = await request(app)
            .get('/api/wallets/balances')
            .set('Authorization', `Bearer ${token}`);

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.data);
        // Ví ban đầu 5,000,000 - chi tiêu 65,000 = 4,935,000
        assert.equal(res.body.data[walletId], 4935000);
    });
});
