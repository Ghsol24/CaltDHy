require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Jar = require('../models/Jar');
const Installment = require('../models/Installment');

async function seedAdmin() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI không tìm thấy trong file .env');
    process.exit(1);
  }

  console.log('🔄 Đang kết nối tới MongoDB Atlas...');
  await mongoose.connect(uri);
  console.log('✅ Kết nối database thành công!');

  const email = 'admin@gmail.com';
  const rawPassword = '123456';
  const hashedPassword = await bcrypt.hash(rawPassword, 12);

  // 1. Tạo hoặc cập nhật User
  let user = await User.findOne({ email });
  if (user) {
    user.name = 'Admin CaltDHy';
    user.password = hashedPassword;
    user.emailVerified = true;
    await user.save();
    console.log('👤 Đã cập nhật tài khoản admin@gmail.com');
  } else {
    user = await User.create({
      name: 'Admin CaltDHy',
      email: email,
      password: hashedPassword,
      emailVerified: true
    });
    console.log('👤 Đã tạo mới tài khoản admin@gmail.com');
  }

  const userId = user._id;

  // 2. Dọn dẹp dữ liệu cũ của user này
  await Promise.all([
    Wallet.deleteMany({ userId }),
    Transaction.deleteMany({ userId }),
    Budget.deleteMany({ userId }),
    Jar.deleteMany({ userId }),
    Installment.deleteMany({ userId })
  ]);
  console.log('🧹 Đã làm sạch dữ liệu cũ của user.');

  // 3. Tạo Ví tiền (Wallets)
  const wallets = await Wallet.insertMany([
    {
      userId,
      name: 'Vietcombank',
      type: 'bank',
      icon: '🏦',
      color: '#078A59',
      initialBalance: 45000000,
      isDefault: true,
      isExcludedFromTotal: false
    },
    {
      userId,
      name: 'Tiền mặt',
      type: 'cash',
      icon: '💵',
      color: '#0891B2',
      initialBalance: 3500000,
      isDefault: false,
      isExcludedFromTotal: false
    },
    {
      userId,
      name: 'Techcombank Visa',
      type: 'credit',
      icon: '💳',
      color: '#DC2626',
      initialBalance: 0,
      creditLimit: 30000000,
      isDefault: false,
      isExcludedFromTotal: false
    },
    {
      userId,
      name: 'Ví MoMo',
      type: 'e-wallet',
      icon: '📱',
      color: '#EC4899',
      initialBalance: 2000000,
      isDefault: false,
      isExcludedFromTotal: false
    }
  ]);
  console.log(`💳 Đã tạo ${wallets.length} ví tiền.`);

  const vcb = wallets.find(w => w.name === 'Vietcombank');
  const cash = wallets.find(w => w.name === 'Tiền mặt');
  const visa = wallets.find(w => w.name === 'Techcombank Visa');
  const momo = wallets.find(w => w.name === 'Ví MoMo');

  // 4. Tạo Ngân sách (Budgets)
  const budgets = await Budget.insertMany([
    { userId, category: 'Food & Dining', limit: 5000000 },
    { userId, category: 'Shopping', limit: 3000000 },
    { userId, category: 'Transportation', limit: 1500000 },
    { userId, category: 'Housing & Bills', limit: 4500000 },
    { userId, category: 'Entertainment', limit: 2000000 },
    { userId, category: 'Health & Beauty', limit: 1200000 }
  ]);
  console.log(`📊 Đã tạo ${budgets.length} danh mục ngân sách.`);

  // 5. Tạo Hũ tiết kiệm (Jars)
  const jars = await Jar.insertMany([
    {
      userId,
      name: 'Quỹ Du lịch Nhật Bản',
      target: 35000000,
      current: 21000000,
      targetDate: '2026-11-30',
      icon: '✈️',
      color: '#2563EB'
    },
    {
      userId,
      name: 'Nâng cấp MacBook Pro',
      target: 45000000,
      current: 32000000,
      targetDate: '2026-12-31',
      icon: '💻',
      color: '#078A59'
    },
    {
      userId,
      name: 'Quỹ Dự phòng Khẩn cấp',
      target: 60000000,
      current: 48000000,
      targetDate: null,
      icon: '🛡️',
      color: '#D97706'
    },
    {
      userId,
      name: 'Quỹ Quà Tết & Gia đình',
      target: 15000000,
      current: 6500000,
      targetDate: '2027-01-20',
      icon: '🎁',
      color: '#DC2626'
    }
  ]);
  console.log(`🫙 Đã tạo ${jars.length} hũ tiết kiệm.`);

  // 6. Tạo Khoản định kỳ & Trả góp (Installments / Recurring)
  const installments = await Installment.insertMany([
    {
      userId,
      name: 'Tiền thuê căn hộ',
      amount: 4500000,
      cycle: 'monthly',
      nextDueDate: '2026-09-01',
      icon: '🏠',
      active: true,
      totalPaid: 18000000
    },
    {
      userId,
      name: 'Trả góp iPhone 16 Pro',
      amount: 2150000,
      cycle: 'monthly',
      nextDueDate: '2026-08-28',
      icon: '📱',
      active: true,
      totalPaid: 6450000
    },
    {
      userId,
      name: 'Internet cáp quang FPT',
      amount: 330000,
      cycle: 'monthly',
      nextDueDate: '2026-08-30',
      icon: '🌐',
      active: true,
      totalPaid: 990000
    },
    {
      userId,
      name: 'Gói Netflix 4K Family',
      amount: 260000,
      cycle: 'monthly',
      nextDueDate: '2026-09-05',
      icon: '🎬',
      active: true,
      totalPaid: 780000
    },
    {
      userId,
      name: 'Thẻ tập Gym California',
      amount: 800000,
      cycle: 'monthly',
      nextDueDate: '2026-09-10',
      icon: '🏋️',
      active: true,
      totalPaid: 2400000
    }
  ]);
  console.log(`🔄 Đã tạo ${installments.length} khoản định kỳ.`);

  // 7. Tạo Lịch sử Giao dịch (Transactions)
  const txns = await Transaction.insertMany([
    // Tháng 8/2026
    {
      userId,
      type: 'income',
      category: 'Salary',
      desc: 'Nhận lương tháng 7 (Công ty chuyển khoản)',
      amount: 35000000,
      date: new Date('2026-08-05T08:30:00Z'),
      walletId: vcb._id
    },
    {
      userId,
      type: 'income',
      category: 'Gift & Bonus',
      desc: 'Thưởng vượt chỉ tiêu KPI Q3',
      amount: 10000000,
      date: new Date('2026-08-15T10:00:00Z'),
      walletId: vcb._id
    },
    {
      userId,
      type: 'income',
      category: 'Investment',
      desc: 'Cổ tức chứng khoán Techcombank',
      amount: 3200000,
      date: new Date('2026-08-18T14:20:00Z'),
      walletId: vcb._id
    },
    {
      userId,
      type: 'expense',
      category: 'Food & Dining',
      desc: 'Ăn tối liên hoan BBQ Gogi House',
      amount: 820000,
      date: new Date('2026-08-24T19:00:00Z'),
      walletId: vcb._id
    },
    {
      userId,
      type: 'expense',
      category: 'Food & Dining',
      desc: 'Cà phê sáng Highlands Coffee',
      amount: 55000,
      date: new Date('2026-08-24T08:15:00Z'),
      walletId: momo._id
    },
    {
      userId,
      type: 'expense',
      category: 'Food & Dining',
      desc: 'Đi siêu thị WinMart cuối tuần',
      amount: 1250000,
      date: new Date('2026-08-23T16:30:00Z'),
      walletId: vcb._id
    },
    {
      userId,
      type: 'expense',
      category: 'Transportation',
      desc: 'Đổ xăng xe máy Shell',
      amount: 110000,
      date: new Date('2026-08-22T09:00:00Z'),
      walletId: cash._id
    },
    {
      userId,
      type: 'expense',
      category: 'Shopping',
      desc: 'Mua quần áo Uniqlo & Zara',
      amount: 1850000,
      date: new Date('2026-08-20T18:45:00Z'),
      walletId: visa._id
    },
    {
      userId,
      type: 'expense',
      category: 'Housing & Bills',
      desc: 'Hóa đơn Điện & Nước tháng 8',
      amount: 1420000,
      date: new Date('2026-08-18T11:00:00Z'),
      walletId: vcb._id
    },
    {
      userId,
      type: 'expense',
      category: 'Entertainment',
      desc: 'Xem phim IMAX CGV & Combo bắp nước',
      amount: 380000,
      date: new Date('2026-08-14T20:00:00Z'),
      walletId: momo._id
    },
    {
      userId,
      type: 'expense',
      category: 'Health & Beauty',
      desc: 'Combo chăm sóc tóc & mặt 30Shine',
      amount: 350000,
      date: new Date('2026-08-10T15:00:00Z'),
      walletId: cash._id
    },
    {
      userId,
      type: 'expense',
      category: 'Food & Dining',
      desc: 'Đặt đồ ăn trưa ShopeeFood',
      amount: 145000,
      date: new Date('2026-08-08T12:30:00Z'),
      walletId: momo._id
    },
    {
      userId,
      type: 'transfer',
      category: 'Chuyển tiền',
      desc: 'Rút tiền mặt tiêu vặt tại cây ATM',
      amount: 2000000,
      fee: 3300,
      date: new Date('2026-08-06T10:00:00Z'),
      walletId: vcb._id,
      toWalletId: cash._id
    },
    {
      userId,
      type: 'transfer',
      category: 'Chuyển tiền',
      desc: 'Nạp tiền ví MoMo để thanh toán online',
      amount: 1500000,
      fee: 0,
      date: new Date('2026-08-03T09:00:00Z'),
      walletId: vcb._id,
      toWalletId: momo._id
    },

    // Tháng 7/2026 (dữ liệu tháng trước để tính xu hướng & so sánh)
    {
      userId,
      type: 'income',
      category: 'Salary',
      desc: 'Nhận lương tháng 6',
      amount: 35000000,
      date: new Date('2026-07-05T08:30:00Z'),
      walletId: vcb._id
    },
    {
      userId,
      type: 'income',
      category: 'Business',
      desc: 'Dự án tư vấn ngoài giờ',
      amount: 8500000,
      date: new Date('2026-07-15T16:00:00Z'),
      walletId: vcb._id
    },
    {
      userId,
      type: 'expense',
      category: 'Housing & Bills',
      desc: 'Tiền thuê căn hộ tháng 7',
      amount: 4500000,
      date: new Date('2026-07-02T10:00:00Z'),
      walletId: vcb._id
    },
    {
      userId,
      type: 'expense',
      category: 'Food & Dining',
      desc: 'Tổng ăn uống & siêu thị tháng 7',
      amount: 4200000,
      date: new Date('2026-07-20T19:00:00Z'),
      walletId: vcb._id
    },
    {
      userId,
      type: 'expense',
      category: 'Shopping',
      desc: 'Mua đồ gia dụng phòng khách',
      amount: 2800000,
      date: new Date('2026-07-25T14:00:00Z'),
      walletId: vcb._id
    }
  ]);
  console.log(`📝 Đã tạo ${txns.length} giao dịch mẫu.`);

  console.log('========================================================');
  console.log('🎉 ĐÃ KHỞI TẠO TÀI KHOẢN VÀ DỮ LIỆU MẪU THÀNH CÔNG!');
  console.log('   📧 Email: admin@gmail.com');
  console.log('   🔑 Password: 123456');
  console.log('========================================================');

  await mongoose.disconnect();
}

// Chạy trực tiếp từ CLI — không tự chạy nếu file này bị require() từ nơi khác,
// vì đây là thao tác tạo tài khoản demo với mật khẩu cố định (123456) trên DB thật.
if (require.main === module) {
    seedAdmin().catch((err) => {
        console.error('❌ Lỗi khi khởi tạo seed data:', err);
        process.exit(1);
    });
}

module.exports = { seedAdmin };
