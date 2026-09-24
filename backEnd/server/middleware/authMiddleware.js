'use strict';
const User = require('../models/User');
const AuthSession = require('../models/AuthSession');
const { hash, sessionToken, clearSession } = require('../utils/sessionSecurity');

async function protect(req, res, next) {
    try {
        const token = sessionToken(req);
        const session = token && await AuthSession.findOne({
            tokenHash: hash(token), expiresAt: { $gt: new Date() }
        }).lean();
        const user = session && await User.findById(session.userId)
            .select('name email avatar emailVerified +authVersion').lean();
        if (!user || session.authVersion !== (user.authVersion || 0)) {
            clearSession(res);
            return res.status(401).json({
                success: false, code: 'SESSION_EXPIRED',
                message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.'
            });
        }
        req.user = { id: user._id.toString(), name: user.name, email: user.email,
            avatar: user.avatar, emailVerified: user.emailVerified === true };
        req.authSession = session;
        return next();
    } catch {
        console.error('[auth] session_lookup_failed');
        return res.status(503).json({ success: false,
            message: 'Dịch vụ xác thực chưa sẵn sàng. Vui lòng thử lại.' });
    }
}
module.exports = { protect };
