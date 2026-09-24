'use strict';

const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
if (process.env.NODE_ENV !== 'test') {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
}
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { csrfProtection, sessionLifetime } = require('./utils/sessionSecurity');
const { localizeApiResponse } = require('./utils/i18n');

function integerSetting(name, fallback, maximum) {
    const value = process.env[name];
    if (value === undefined) return fallback;
    if (!/^[1-9]\d*$/.test(value)) throw new Error('Invalid configuration.');
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number > maximum) {
        throw new Error('Invalid configuration.');
    }
    return number;
}

function originSetting(value, production, allowPath = false) {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (!['http:', 'https:'].includes(url.protocol) || url.username ||
        url.password || url.search || url.hash ||
        (!allowPath && url.pathname !== '/') ||
        (production && !local && url.protocol !== 'https:')) {
        throw new Error('Invalid configuration.');
    }
    return url.origin;
}

let config;
try {
    const mode = process.env.NODE_ENV || 'production';
    if (!['production', 'development', 'test'].includes(mode)) {
        throw new Error('Invalid configuration.');
    }
    process.env.NODE_ENV = mode;
    sessionLifetime();
    if (process.env.COOKIE_SECURE && !['true', 'false'].includes(process.env.COOKIE_SECURE)) {
        throw new Error('Invalid cookie configuration.');
    }
    const port = integerSetting('PORT', 24127, 65535);
    const host = process.env.HOST || '127.0.0.1';
    if (!net.isIP(host)) throw new Error('Invalid configuration.');
    const origins = new Set([
        'http://localhost:' + port,
        'http://127.0.0.1:' + port,
        'http://[::1]:' + port
    ]);
    if (mode !== 'production') {
        for (const devPort of [5173, 4173, 3000]) {
            origins.add('http://localhost:' + devPort);
            origins.add('http://127.0.0.1:' + devPort);
        }
    }
    for (const value of (process.env.CORS_WHITELIST || '').split(',')) {
        if (value.trim()) origins.add(originSetting(value.trim(), mode === 'production'));
    }
    if (process.env.CLIENT_URL) {
        origins.add(originSetting(process.env.CLIENT_URL, mode === 'production', true));
    }
    config = {
        port, host, origins,
        apiLimit: integerSetting('API_RATE_LIMIT_MAX', 300, 100000),
        authLimit: integerSetting('AUTH_RATE_LIMIT_MAX', 10, 1000),
        publicProduction: mode === 'production' &&
            host !== '127.0.0.1' && host !== '::1'
    };
} catch {
    if (require.main === module) {
        console.error('[server] invalid_configuration');
        process.exit(1);
    }
    throw new Error('Invalid server configuration.');
}

mongoose.set('bufferCommands', false);
mongoose.set('autoCreate', false);
mongoose.set('autoIndex', false);
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', false);

app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            scriptSrcAttr: ["'none'"],
            // React uses inline styles; scripts still cannot run inline.
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            connectSrc: ["'self'", ...config.origins],
            objectSrc: ["'none'"],
            baseUri: ["'none'"],
            frameAncestors: ["'none'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: config.publicProduction ? [] : null
        }
    },
    strictTransportSecurity: config.publicProduction
        ? { maxAge: 31536000, includeSubDomains: false } : false,
    referrerPolicy: { policy: 'no-referrer' }
}));

app.use(cors({
    origin(origin, callback) {
        if (!origin || config.origins.has(origin)) return callback(null, true);
        const error = new Error('Origin denied.');
        error.code = 'CORS_ORIGIN_DENIED';
        return callback(error);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Accept-Language', 'X-CSRF-Token', 'Idempotency-Key'],
    credentials: true
}));

app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});
app.use('/api', localizeApiResponse);
const limitMessage = {
    success: false,
    message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.'
};
// Every API path is counted, including auth paths with unusual casing.
app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.apiLimit,
    standardHeaders: true,
    legacyHeaders: false,
    message: limitMessage
}));
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.authLimit,
    standardHeaders: true,
    legacyHeaders: false,
    message: limitMessage,
    skip: req => ['GET', 'HEAD'].includes(req.method) || req.path === '/logout'
});

app.use('/api', csrfProtection);
app.use(express.json({ limit: '2mb' }));
function checkDbReady(req, res, next) {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            success: false,
            message: 'Dịch vụ dữ liệu chưa sẵn sàng. Vui lòng thử lại sau.'
        });
    }
    return next();
}

app.get('/api/health', (req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
        status: connected ? 'OK' : 'UNAVAILABLE',
        db: connected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});
app.use('/api/auth', authLimiter, checkDbReady, require('./routes/auth'));
app.use('/api/spending', checkDbReady, require('./routes/spending'));
app.use('/api/jars', checkDbReady, require('./routes/jars'));
app.use('/api/wallets', checkDbReady, require('./routes/wallets'));
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: 'API không tồn tại.' });
});

const reactDistPath = path.join(__dirname, '..', '..', 'frontEnd-react', 'dist');
const reactIndexPath = path.join(reactDistPath, 'index.html');
// Do not publish dotfiles, source maps or configuration accidentally in dist.
app.use((req, res, next) => {
    let pathname;
    try { pathname = decodeURIComponent(req.path); } catch {
        return res.status(400).json({ success: false, message: 'Đường dẫn không hợp lệ.' });
    }
    if (pathname.split('/').some(segment => segment.startsWith('.')) ||
        /\.(?:map|pem|key|p12|pfx|zip|sql|bak)$/i.test(pathname)) {
        return res.status(404).end();
    }
    return next();
});
if (fs.existsSync(reactIndexPath)) {
    app.use(express.static(reactDistPath, { dotfiles: 'deny', index: false }));
    app.get('*', (req, res, next) => {
        if (!req.accepts('html')) return next();
        res.set('Cache-Control', 'no-store');
        return res.sendFile(reactIndexPath);
    });
}
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Không tìm thấy tài nguyên.' });
});

app.use((err, req, res, next) => {
    // Never log the error, URL, body, headers, connection URI or stack.
    let status = 500;
    let message = 'Lỗi server. Vui lòng thử lại.';
    let event = 'request_failed';
    if (err.code === 'CORS_ORIGIN_DENIED') {
        status = 403;
        message = 'Yêu cầu bị từ chối bởi chính sách bảo mật CORS.';
        event = 'origin_denied';
    } else if (err.type === 'entity.too.large') {
        status = 413;
        message = 'Dung lượng yêu cầu quá lớn. Vui lòng giảm kích thước dữ liệu (tối đa 2MB).';
        event = 'body_too_large';
    } else if (err.type === 'entity.parse.failed' || err instanceof URIError) {
        status = 400;
        message = 'Dữ liệu yêu cầu không hợp lệ.';
        event = 'invalid_request';
    } else if (err.status === 400 || err.status === 415) {
        status = err.status;
        message = 'Định dạng yêu cầu không được hỗ trợ.';
        event = 'unsupported_request';
    }
    console.error('[server] ' + event);
    if (res.headersSent) {
        res.destroy();
        return;
    }
    res.set('Cache-Control', 'no-store');
    res.status(status).json({ success: false, message });
});

if (require.main === module) {
    let server;
    let stopping = false;

    async function stop(exitCode) {
        if (stopping) return;
        stopping = true;
        const deadline = setTimeout(() => {
            console.error('[server] shutdown_timeout');
            process.exit(1);
        }, 10000);
        try {
            if (server && server.listening) {
                await new Promise(resolve => {
                    server.close(resolve);
                    if (server.closeIdleConnections) server.closeIdleConnections();
                });
            }
            await mongoose.disconnect();
        } catch {
            exitCode = 1;
            console.error('[server] shutdown_failed');
        } finally {
            clearTimeout(deadline);
            process.exit(exitCode);
        }
    }

    process.once('SIGINT', () => { void stop(0); });
    process.once('SIGTERM', () => { void stop(0); });
    mongoose.connection.on('error', () => {
        console.error('[server] database_error');
    });
    mongoose.connection.on('disconnected', () => {
        if (!stopping) console.error('[server] database_disconnected');
    });

    async function start() {
        const uri = process.env.MONGODB_URI;
        const secret = process.env.JWT_SECRET;
        if (typeof uri !== 'string' || !/^mongodb(?:\+srv)?:\/\//.test(uri) ||
            typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32 ||
            secret === 'projectcanhan_super_secret_key_2024') {
            throw new Error('Invalid startup configuration.');
        }
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        const topology = await mongoose.connection.db.admin().command({ hello: 1 });
        if (!topology.setName && topology.msg !== 'isdbgrid') throw new Error('Transactions require a replica set.');
        for (const model of Object.values(mongoose.models)) {
            await model.createCollection();
            await model.createIndexes();
        }
        if (stopping) return;
        await new Promise((resolve, reject) => {
            server = app.listen(config.port, config.host);
            server.once('error', reject);
            server.once('listening', () => {
                server.removeListener('error', reject);
                server.on('error', () => {
                    console.error('[server] listener_failed');
                    void stop(1);
                });
                resolve();
            });
        });
        console.log('[server] ready');
    }

    void start().catch(() => {
        console.error('[server] startup_failed');
        void stop(1);
    });
}

module.exports = app;
