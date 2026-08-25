const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Jar = require('../models/Jar');
const Installment = require('../models/Installment');

async function cleanup() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error('MONGODB_URI không tìm thấy trong file .env');
    }

    console.log('🔄 Đang kết nối tới MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Kết nối database thành công!');

    const allUsers = await User.find({}, 'name email emailVerified createdAt');
    console.log(`📋 Tổng số người dùng hiện tại trong DB: ${allUsers.length}`);
    allUsers.forEach(u => {
        console.log(` - [${u._id}] ${u.name} (${u.email}) - emailVerified: ${u.emailVerified} - Tạo lúc: ${u.createdAt}`);
    });

    const adminEmail = 'admin@gmail.com';
    const nonAdminUsers = await User.find({ email: { $ne: adminEmail } });
    const nonAdminIds = nonAdminUsers.map(u => u._id);

    console.log(`\n🧹 Số lượng tài khoản cần xóa (ngoại trừ ${adminEmail}): ${nonAdminIds.length}`);

    if (nonAdminIds.length > 0) {
        const [wRes, tRes, bRes, jRes, iRes, uRes] = await Promise.all([
            Wallet.deleteMany({ userId: { $in: nonAdminIds } }),
            Transaction.deleteMany({ userId: { $in: nonAdminIds } }),
            Budget.deleteMany({ userId: { $in: nonAdminIds } }),
            Jar.deleteMany({ userId: { $in: nonAdminIds } }),
            Installment.deleteMany({ userId: { $in: nonAdminIds } }),
            User.deleteMany({ _id: { $in: nonAdminIds } })
        ]);

        console.log(`✅ Đã xóa ${uRes.deletedCount} tài khoản.`);
        console.log(`   - Ví đã xóa: ${wRes.deletedCount}`);
        console.log(`   - Giao dịch đã xóa: ${tRes.deletedCount}`);
        console.log(`   - Ngân sách đã xóa: ${bRes.deletedCount}`);
        console.log(`   - Hũ tiết kiệm đã xóa: ${jRes.deletedCount}`);
        console.log(`   - Trả góp đã xóa: ${iRes.deletedCount}`);
    }

    // Đảm bảo tài khoản admin tồn tại và emailVerified = true
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
        console.log('⚠️ Tài khoản admin chưa tồn tại, đang tạo mới...');
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('123456', 12);
        admin = await User.create({
            name: 'Admin CaltDHy',
            email: adminEmail,
            password: hashedPassword,
            emailVerified: true
        });
        console.log('✅ Đã tạo tài khoản admin@gmail.com (Mật khẩu: 123456)');
    } else {
        admin.emailVerified = true;
        await admin.save();
        console.log(`✅ Tài khoản ${adminEmail} đã được giữ lại và kích hoạt emailVerified: true.`);
    }

    const remainingUsers = await User.find({}, 'name email emailVerified');
    console.log('\n👤 Danh sách người dùng còn lại:');
    remainingUsers.forEach(u => {
        console.log(` - ${u.name} (${u.email}) - emailVerified: ${u.emailVerified}`);
    });
}

cleanup()
    .catch((err) => {
        console.error('❌ Lỗi dọn dẹp:', err);
    })
    .finally(async () => {
        await mongoose.disconnect();
        console.log('🔌 Đã ngắt kết nối database.');
    });
