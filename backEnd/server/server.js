require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: false
}));

// CORS Whitelist — allow backend port and Vite dev server ports (5173 and 3000) for local development
const whitelist = process.env.CORS_WHITELIST 
    ? process.env.CORS_WHITELIST.split(',') 
    : ['http://localhost:24127', 'http://localhost:5173', 'http://localhost:3000'];
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || whitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Rate Limiting — Chung cho toàn bộ /api/
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 100 : 10000,
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// Rate Limiting — Nghiêm ngặt hơn cho các route xác thực nhạy cảm
// Tối đa 10 requests / 15 phút / 1 IP ở Production để chặn brute force
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 10 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau 15 phút.'
    }
});

app.use(express.json());

// Serve static files — React build output (frontEnd/dist) for production
// Run `npm run build` inside /frontEnd to regenerate.
app.use(express.static(path.join(__dirname, '..', '..', 'frontEnd', 'dist')));

// Middleware kiểm tra database cho API routes
const checkDbReady = (req, res, next) => {
    // Cho phép kết nối (1) hoặc đang kết nối (2) để Mongoose tự động buffer câu truy vấn
    if (mongoose.connection.readyState !== 1 && mongoose.connection.readyState !== 2) {
        return res.status(503).json({
            success: false,
            message: 'Server đang chạy ở chế độ Ngoại tuyến. Vui lòng kiểm tra kết nối database.'
        });
    }
    next();
};

// API Routes
// authLimiter áp dụng cho toàn bộ /api/auth (gồm cả /login, /register, /forgot-password, /reset-password)
// /api/auth/profile (PUT) cũng nằm trong đây nhưng vẫn chấp nhận vì user hiếm khi cập nhật profile > 10 lần/15 phút
app.use('/api/auth', authLimiter, checkDbReady, require('./routes/auth'));

// TODO: Route /api/events hiện tại chưa có UI tương ứng ở Frontend.
// Được tạm ẩn để giảm attack surface.
// Bỏ comment khi cần phát triển tính năng lịch trình.
// app.use('/api/events', checkDbReady, require('./routes/events'));

app.use('/api/spending', checkDbReady, require('./routes/spending'));
app.use('/api/jars', checkDbReady, require('./routes/jars'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'CaltDHy server đang chạy!', 
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Lỗi server không xác định.'
    });
});

// =============================================
// Kết nối MongoDB rồi start server
// Nếu kết nối MongoDB thất bại → vẫn khởi động server để phục vụ
// Frontend (Offline Mode). API sẽ trả 503 nếu DB chưa sẵn sàng.
// =============================================
const PORT = process.env.PORT || 24127;

function startServer() {
    app.listen(PORT, () => {
        const dbStatus = mongoose.connection.readyState === 1 ? 'MongoDB Atlas ✅' : 'Offline Mode ⚠️ (No DB)';
        console.log('========================================================');
        console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
        console.log(`🗄️  CaltDHy – Chế độ: ${dbStatus}`);
        if (mongoose.connection.readyState !== 1) {
            console.log('   ⚠️  WARNING: Không có kết nối database.');
            console.log('   📴  Ứng dụng hoạt động ở chế độ Ngoại tuyến (Offline Mode).');
            console.log('   💡  Dữ liệu sẽ được lưu cục bộ trên trình duyệt của người dùng.');
            console.log('   🔧  Kiểm tra lại MONGODB_URI trong file .env để kết nối database.');
        }
        console.log('========================================================');
    });
}

if (!process.env.MONGODB_URI) {
    console.error('');
    console.error('⚠️  [CẢNH BÁO] Chưa cấu hình MONGODB_URI trong file .env');
    console.error('   → Server vẫn sẽ khởi động ở chế độ Offline Mode.');
    console.error('');
    startServer();
} else {
    mongoose
        .connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000
        })
        .then(() => {
            console.log('✅ Connected to MongoDB Atlas successfully');
            console.log(`   URI: ${process.env.MONGODB_URI?.replace(/:([^@]+)@/, ':****@')}`);
            startServer();
        })
        .catch((error) => {
            console.error('');
            console.error('⚠️  [CẢNH BÁO] Không thể kết nối MongoDB Atlas:');
            console.error('   Message:', error.message);
            console.error('   → Server vẫn sẽ khởi động ở chế độ Offline Mode.');
            console.error('');
            startServer(); // ✅ Vẫn khởi động server – phục vụ file tĩnh Frontend
        });
}
