require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

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
    res.json({ status: 'OK', message: 'projectcanhan server đang chạy!' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Lỗi server không xác định.'
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    console.log(`📅 CaltDHy – Offline-first / JSON DB`);
});
