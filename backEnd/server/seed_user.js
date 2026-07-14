/**
 * seed_user.js
 * Script tạo dữ liệu mẫu cho tài khoản test1@gmail.com
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

// Load env từ file .env cùng cấp
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Transaction = require('./models/Transaction');
const Budget = require('./models/Budget');
const Jar = require('./models/Jar');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ Lỗi: MONGODB_URI chưa được cấu hình trong file .env');
    process.exit(1);
}

async function seed() {
    try {
        console.log('🔄 Đang kết nối tới database...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Đã kết nối thành công!');

        const email = 'test1@gmail.com';
        const passwordPlain = '111111';

        // 1. Tìm hoặc tạo user
        let user = await User.findOne({ email });
        if (user) {
            console.log(`👤 Tìm thấy người dùng tồn tại: ${email}. Đang tiến hành làm sạch và nạp lại dữ liệu...`);
        } else {
            console.log(`👤 Tạo mới người dùng: ${email}`);
            const hashedPassword = await bcrypt.hash(passwordPlain, 12);
            user = new User({
                name: 'Trần Gia Huy',
                email: email,
                password: hashedPassword,
                customCategories: ['Lương', 'Freelance', 'Ăn uống', 'Di chuyển', 'Giải trí', 'Mua sắm', 'Tiền nhà']
            });
            await user.save();
        }

        const userId = user._id;

        // 2. Làm sạch dữ liệu cũ của user này
        await Transaction.deleteMany({ userId });
        await Budget.deleteMany({ userId });
        await Jar.deleteMany({ userId });
        console.log('🧹 Đã dọn sạch dữ liệu cũ (Transactions, Budgets, Jars) của user.');

        // 3. Tạo dữ liệu mẫu: Transactions
        const today = new Date();
        const formatDate = (offsetDays) => {
            const d = new Date(today);
            d.setDate(today.getDate() - offsetDays);
            return d.toISOString().slice(0, 10);
        };

        const mockTransactions = [
            // --- THÁNG 4/2026 ---
            { userId, type: 'income', desc: 'Lương tháng 4', amount: 15000000, category: 'Lương', date: '2026-04-05' },
            { userId, type: 'income', desc: 'Thù lao Freelance tháng 4', amount: 2500000, category: 'Freelance', date: '2026-04-20' },
            { userId, type: 'expense', desc: 'Tiền thuê nhà tháng 4', amount: 3000000, category: 'Tiền nhà', date: '2026-04-05' },
            { userId, type: 'expense', desc: 'Ăn lẩu cuối tuần', amount: 250000, category: 'Ăn uống', date: '2026-04-12' },
            { userId, type: 'expense', desc: 'Cơm gia đình', amount: 180000, category: 'Ăn uống', date: '2026-04-18' },
            { userId, type: 'expense', desc: 'Mua sách phát triển bản thân', amount: 1200000, category: 'Mua sắm', date: '2026-04-15' },
            { userId, type: 'expense', desc: 'Tiền điện nước mạng', amount: 450000, category: 'Tiền nhà', date: '2026-04-10' },

            // --- THÁNG 5/2026 ---
            { userId, type: 'income', desc: 'Lương tháng 5', amount: 15000000, category: 'Lương', date: '2026-05-05' },
            { userId, type: 'income', desc: 'Thù lao Freelance tháng 5', amount: 4000000, category: 'Freelance', date: '2026-05-18' },
            { userId, type: 'expense', desc: 'Tiền thuê nhà tháng 5', amount: 3000000, category: 'Tiền nhà', date: '2026-05-05' },
            { userId, type: 'expense', desc: 'Liên hoan công ty', amount: 320000, category: 'Ăn uống', date: '2026-05-10' },
            { userId, type: 'expense', desc: 'Ăn tối cùng bạn', amount: 290000, category: 'Ăn uống', date: '2026-05-24' },
            { userId, type: 'expense', desc: 'Xem liveshow ca nhạc', amount: 600000, category: 'Giải trí', date: '2026-05-20' },
            { userId, type: 'expense', desc: 'Mua thuốc & thực phẩm chức năng', amount: 350000, category: 'Ăn uống', date: '2026-05-15' },

            // --- THÁNG 6/2026 ---
            { userId, type: 'income', desc: 'Lương tháng 6', amount: 15000000, category: 'Lương', date: '2026-06-05' },
            { userId, type: 'income', desc: 'Thù lao Freelance tháng 6', amount: 3000000, category: 'Freelance', date: '2026-06-22' },
            { userId, type: 'expense', desc: 'Tiền thuê nhà tháng 6', amount: 3000000, category: 'Tiền nhà', date: '2026-06-05' },
            { userId, type: 'expense', desc: 'Ăn uống cuối tuần', amount: 400000, category: 'Ăn uống', date: '2026-06-08' },
            { userId, type: 'expense', desc: 'Cà phê họp nhóm', amount: 150000, category: 'Ăn uống', date: '2026-06-15' },
            { userId, type: 'expense', desc: 'Mua bàn ghế làm việc mới', amount: 2500000, category: 'Mua sắm', date: '2026-06-18' },
            { userId, type: 'expense', desc: 'Bảo dưỡng xe máy', amount: 300000, category: 'Di chuyển', date: '2026-06-12' },

            // --- THÁNG 7/2026 (Tháng hiện tại) ---
            { userId, type: 'income', desc: 'Lương tháng 7', amount: 15000000, category: 'Lương', date: '2026-07-05' },
            { userId, type: 'income', desc: 'Thù lao Freelance tháng 7', amount: 3500000, category: 'Freelance', date: '2026-07-10' },
            { userId, type: 'expense', desc: 'Tiền thuê nhà tháng 7', amount: 3000000, category: 'Tiền nhà', date: '2026-07-05' },
            { userId, type: 'expense', desc: 'Ăn lẩu buffet cuối tuần', amount: 250000, category: 'Ăn uống', date: '2026-07-11' },
            { userId, type: 'expense', desc: 'Cà phê sáng cùng bạn', amount: 45000, category: 'Ăn uống', date: '2026-07-13' },
            { userId, type: 'expense', desc: 'Mua giày sneaker mới', amount: 1200000, category: 'Mua sắm', date: '2026-07-09' },
            { userId, type: 'expense', desc: 'Vé xem phim IMAX', amount: 300000, category: 'Giải trí', date: '2026-07-12' },
            { userId, type: 'expense', desc: 'Đổ xăng xe máy', amount: 150000, category: 'Di chuyển', date: '2026-07-08' }
        ];

        await Transaction.insertMany(mockTransactions);
        console.log('📈 Đã thêm 8 giao dịch mẫu (Thu nhập & Chi tiêu).');

        // 4. Tạo dữ liệu mẫu: Budgets
        const mockBudgets = [
            { userId, category: 'Ăn uống', limit: 2000000 },
            { userId, category: 'Mua sắm', limit: 1500000 },
            { userId, category: 'Giải trí', limit: 800000 }
        ];

        await Budget.insertMany(mockBudgets);
        console.log('🛡️ Đã thêm 3 hạn mức chi tiêu (Budgets).');

        // 5. Tạo dữ liệu mẫu: Jars
        const mockJars = [
            {
                userId,
                name: 'Mua iPhone Mới',
                icon: '📱',
                target: 20000000,
                current: 8500000,
                color: '#9b59b6',
                targetDate: formatDate(-180), // 6 tháng tới
                history: [
                    { type: 'deposit', amount: 5000000, reason: 'Nạp quỹ ban đầu', date: new Date(formatDate(15)) },
                    { type: 'deposit', amount: 3500000, reason: 'Trích thù lao Freelance', date: new Date(formatDate(2)) }
                ]
            },
            {
                userId,
                name: 'Quỹ Du Lịch Hè',
                icon: '✈️',
                target: 15000000,
                current: 5000000,
                color: '#1abc9c',
                targetDate: formatDate(-90), // 3 tháng tới
                history: [
                    { type: 'deposit', amount: 5000000, reason: 'Nạp quỹ đợt 1', date: new Date(formatDate(10)) }
                ]
            }
        ];

        await Jar.insertMany(mockJars);
        console.log('🫙 Đã thêm 2 hũ tích lũy mẫu (Jars).');

        console.log('\n=========================================');
        console.log('🎉 ĐÃ HOÀN THÀNH NẠP DỮ LIỆU MẪU THÀNH CÔNG!');
        console.log(`📧 Tài khoản: ${email}`);
        console.log(`🔑 Mật khẩu: ${passwordPlain}`);
        console.log('=========================================');

    } catch (error) {
        console.error('❌ Đã xảy ra lỗi trong quá trình seed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Đã đóng kết nối database.');
        process.exit(0);
    }
}

seed();
