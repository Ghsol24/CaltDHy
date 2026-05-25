require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve static files (Frontend)
app.use(express.static(path.join(__dirname, '..', '..', 'frontEnd')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/spending', require('./routes/spending'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'CaltDHy server đang chạy!', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
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
// Kết nối MongoDB rồi mới start server
// =============================================
const PORT = process.env.PORT || 24127;

mongoose
    .connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
    })
    .then(() => {
        console.log('✅ Connected to MongoDB Atlas successfully');
        console.log(`   URI: ${process.env.MONGODB_URI?.replace(/:([^@]+)@/, ':****@')}`); // ẩn password trong log

        app.listen(PORT, () => {
            console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
            console.log(`🗄️  CaltDHy – MongoDB Atlas mode`);
        });
    })
    .catch((error) => {
        console.error('❌ Không thể kết nối MongoDB Atlas. Chi tiết lỗi:');
        console.error('   Message :', error.message);
        console.error('   Code    :', error.code ?? 'N/A');
        console.error('   Reason  :', error.reason ?? 'Kiểm tra lại MONGODB_URI trong file .env');
        process.exit(1);
    });
