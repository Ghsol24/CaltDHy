'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const User = require('../models/User');
const Invitation = require('../models/Invitation');
const Wallet = require('../models/Wallet');
const AuthSession = require('../models/AuthSession');
const { protect } = require('../middleware/authMiddleware');
const { runWithTransaction } = require('../utils/mongoTransaction');
const { issueCsrf, createSession, setSession, revokeSession, clearSession } = require('../utils/sessionSecurity');
const { validEmail, normalizeEmail } = require('../utils/emailAddress');
const { configuredProvider, sendAccountEmail } = require('../utils/accountEmail');
const router = express.Router();

const validPassword = value => typeof value === 'string' && value.length >= 12 &&
    Buffer.byteLength(value, 'utf8') <= 72;
const validToken = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const avatarPresets = new Set(['💼', '🚀', '⚡', '🎯', '👑', '💎', '🏆', '☕', '🦁', '🦊', '🐱', '🌲', '🍀', '🛸', '🎮', '💻']);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const publicUser = user => ({
    id: user._id.toString(), name: user.name, email: user.email,
    avatar: user.avatar || '', emailVerified: user.emailVerified === true
});
const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function buildAccountLink(pathname, token, email) {
    const configured = process.env.CLIENT_URL;
    if (typeof configured !== 'string' || !/^https?:\/\//.test(configured)) throw new Error('Invalid link configuration.');
    const base = new URL(configured);
    const local = ['development', 'test'].includes(process.env.NODE_ENV) &&
        ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
    if (base.username || base.password || base.search || base.hash ||
        (base.protocol !== 'https:' && !(base.protocol === 'http:' && local))) throw new Error('Invalid link configuration.');
    base.pathname = base.pathname.replace(/\/+$/, '') + '/';
    const link = new URL(pathname, base);
    link.searchParams.set('token', token);
    link.searchParams.set('email', email);
    return link.toString();
}
async function sendLink(user, link, verification) {
    const action = verification ? 'Xác minh email' : 'Đặt lại mật khẩu';
    await sendAccountEmail({
        to: user.email,
        subject: action + ' – CaltDHy',
        html: '<p>Xin chào ' + escapeHtml(user.name) + ',</p><p><a href="' +
            escapeHtml(link) + '">' + action +
            '</a></p><p>Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email.</p>',
        text: 'Xin chào ' + user.name + ',\n\n' + action + ': ' + link +
            '\n\nNếu bạn không yêu cầu thao tác này, hãy bỏ qua email.'
    });
}
function failure(res, event, error) {
    console.error('[auth] ' + event);
    if (error?.code === 11000) return res.status(409).json({ success: false, message: 'Thông tin tài khoản đã được sử dụng.' });
    return res.status(500).json({ success: false, message: 'Không thể hoàn thành yêu cầu. Vui lòng thử lại.' });
}

router.get('/csrf', (req, res) => res.json({ success: true, csrfToken: issueCsrf(req, res) }));
router.get('/registration', (req, res) => res.json({
    success: true, inviteOnly: req.app.locals.registrationMode === 'invite'
}));
router.get(['/session', '/profile'], protect, (req, res) => {
    res.json({ success: true, user: req.user, csrfToken: issueCsrf(req, res) });
});
router.post('/logout', async (req, res) => {
    try {
        await revokeSession(req);
        clearSession(res);
        return res.json({ success: true });
    } catch (error) { return failure(res, 'logout_failed', error); }
});

router.post('/register', async (req, res) => {
    try {
        const { name, email, password, inviteToken } = req.body || {};
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||
            !validEmail(email) || !validPassword(password)) {
            return res.status(400).json({ success: false,
                message: 'Tên/email không hợp lệ. Mật khẩu cần ít nhất 12 ký tự và tối đa 72 byte.' });
        }
        const inviteOnly = req.app.locals.registrationMode === 'invite';
        if (inviteOnly && (typeof inviteToken !== 'string' || !/^[a-f0-9]{64}$/.test(inviteToken))) {
            return res.status(403).json({ success: false, message: 'Cần liên kết mời hợp lệ để tạo tài khoản.' });
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const result = await runWithTransaction(async session => {
            if (inviteOnly) {
                const invitation = await Invitation.findOneAndUpdate({
                    tokenHash: hash(inviteToken), email: normalizeEmail(email),
                    expiresAt: { $gt: new Date() }, usedAt: null
                }, { $set: { usedAt: new Date() } }, { session, new: true });
                if (!invitation) {
                    const error = new Error('Invalid invitation.');
                    error.code = 'INVITE_INVALID';
                    throw error;
                }
            }
            const [user] = await User.create([{
                name: name.trim(), email: normalizeEmail(email), password: passwordHash, emailVerified: false
            }], { session });
            await Wallet.create([{ userId: user._id, name: 'Tiền mặt', type: 'cash',
                icon: '💵', initialBalance: 0, isDefault: true }], { session });
            await revokeSession(req, session);
            return { user, issued: await createSession(user, session) };
        });
        return res.status(201).json({ success: true, message: 'Đăng ký thành công!',
            user: publicUser(result.user), csrfToken: setSession(req, res, result.issued) });
    } catch (error) {
        if (error?.code === 'INVITE_INVALID') {
            return res.status(403).json({ success: false, message: 'Liên kết mời không hợp lệ hoặc đã hết hạn.' });
        }
        return failure(res, 'register_failed', error);
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!validEmail(email) || typeof password !== 'string' || password.length === 0 ||
            Buffer.byteLength(password, 'utf8') > 72) {
            return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không hợp lệ.' });
        }
        const user = await User.findOne({ email: normalizeEmail(email) }).select('+password +authVersion');
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
        }
        const issued = await runWithTransaction(async session => {
            await revokeSession(req, session);
            return createSession(user, session);
        });
        return res.json({ success: true, message: 'Đăng nhập thành công!',
            user: publicUser(user), csrfToken: setSession(req, res, issued) });
    } catch (error) { return failure(res, 'login_failed', error); }
});

router.post('/verify-email', async (req, res) => {
    try {
        const { email, token } = req.body || {};
        if (!validEmail(email) || !validToken(token)) {
            return res.status(400).json({ success: false, message: 'Liên kết xác minh không hợp lệ.' });
        }
        const user = await User.findOneAndUpdate({
            email: normalizeEmail(email), emailVerificationToken: hash(token),
            emailVerificationExpiry: { $gt: new Date() }
        }, { $set: { emailVerified: true },
            $unset: { emailVerificationToken: '', emailVerificationExpiry: '' } });
        if (!user) return res.status(400).json({ success: false, message: 'Liên kết không hợp lệ hoặc đã hết hạn.' });
        return res.json({ success: true, message: 'Email đã được xác minh.' });
    } catch (error) { return failure(res, 'verify_email_failed', error); }
});

async function requestEmail(req, res, verification) {
    const generic = { success: true, message: 'Nếu email phù hợp, hệ thống sẽ xử lý yêu cầu gửi liên kết.' };
    if (!configuredProvider() || !process.env.CLIENT_URL) {
        return res.status(503).json({ success: false,
            message: 'Chức năng gửi email chưa sẵn sàng. Vui lòng liên hệ chủ ứng dụng.' });
    }
    try {
        const email = req.body?.email;
        if (!validEmail(email)) return res.json(generic);
        const user = await User.findOne({ email: normalizeEmail(email) });
        if (!user || (verification && user.emailVerified)) return res.json(generic);
        const token = crypto.randomBytes(32).toString('hex');
        const link = buildAccountLink(verification ? 'verify-email' : 'reset-password', token, user.email);
        const tokenField = verification ? 'emailVerificationToken' : 'resetPasswordToken';
        const expiryField = verification ? 'emailVerificationExpiry' : 'resetPasswordExpiry';
        await User.updateOne({ _id: user._id }, { $set: {
            [tokenField]: hash(token), [expiryField]: new Date(Date.now() + (verification ? 86400000 : 900000))
        } });
        try { await sendLink(user, link, verification); } catch {
            console.error('[auth] email_delivery_failed');
            await User.updateOne({ _id: user._id, [tokenField]: hash(token) },
                { $unset: { [tokenField]: '', [expiryField]: '' } });
        }
    } catch { console.error('[auth] email_request_failed'); }
    return res.json(generic);
}
router.post('/resend-verification', (req, res) => requestEmail(req, res, true));
router.post('/forgot-password', (req, res) => requestEmail(req, res, false));

router.post('/reset-password', async (req, res) => {
    try {
        const { token, email, newPassword } = req.body || {};
        if (!validToken(token) || !validEmail(email) || !validPassword(newPassword)) {
            return res.status(400).json({ success: false, message: 'Thông tin không hợp lệ. Mật khẩu cần 12 ký tự, tối đa 72 byte.' });
        }
        const password = await bcrypt.hash(newPassword, 12);
        // One atomic consume: concurrent requests cannot both use the same token.
        const user = await User.findOneAndUpdate({
            email: normalizeEmail(email), resetPasswordToken: hash(token),
            resetPasswordExpiry: { $gt: new Date() }
        }, {
            $set: { password, passwordChangedAt: new Date() }, $inc: { authVersion: 1 },
            $unset: { resetPasswordToken: '', resetPasswordExpiry: '' }
        });
        if (!user) return res.status(400).json({ success: false, message: 'Liên kết không hợp lệ hoặc đã hết hạn.' });
        return res.json({ success: true, message: 'Đã đặt lại mật khẩu. Vui lòng đăng nhập lại.' });
    } catch (error) { return failure(res, 'reset_password_failed', error); }
});

router.put('/profile', protect, async (req, res) => {
    try {
        const { name, email, avatar, currentPassword, newPassword } = req.body || {};
        if ((name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 100)) ||
            (email !== undefined && !validEmail(email)) ||
            (newPassword !== undefined && newPassword !== '' && !validPassword(newPassword)) ||
            (avatar !== undefined && (typeof avatar !== 'string' ||
                (avatar && !avatarPresets.has(avatar) && !/^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/]+=*$/.test(avatar))))) {
            return res.status(400).json({ success: false, message: 'Thông tin tài khoản không hợp lệ.' });
        }
        if (avatar && Buffer.byteLength(avatar, 'utf8') > 1.5 * 1024 * 1024) {
            return res.status(400).json({ success: false, message: 'Kích thước ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 1MB.' });
        }
        const result = await runWithTransaction(async session => {
            const user = await User.findById(req.user.id).select('+password +authVersion').session(session);
            const currentSession = await AuthSession.findById(req.authSession._id).session(session);
            if (!currentSession || currentSession.expiresAt <= new Date() || !user ||
                currentSession.authVersion !== (user.authVersion || 0) ||
                (user.authVersion || 0) !== req.authSession.authVersion) {
                const error = new Error('Session changed.'); error.status = 401; throw error;
            }
            const changedEmail = email !== undefined && normalizeEmail(email) !== user.email;
            if (newPassword || changedEmail) {
                if (typeof currentPassword !== 'string' || Buffer.byteLength(currentPassword) > 72 ||
                    !await bcrypt.compare(currentPassword, user.password)) {
                    const error = new Error('Current password required.'); error.status = 400; throw error;
                }
                user.authVersion = (user.authVersion || 0) + 1;
                user.passwordChangedAt = new Date();
                user.resetPasswordToken = undefined;
                user.resetPasswordExpiry = undefined;
            }
            if (newPassword) user.password = await bcrypt.hash(newPassword, 12);
            if (changedEmail) {
                user.email = normalizeEmail(email); user.emailVerified = false;
                user.emailVerificationToken = undefined; user.emailVerificationExpiry = undefined;
            }
            if (name !== undefined) user.name = name.trim();
            if (avatar !== undefined) user.avatar = avatar;
            await user.save({ session });
            currentSession.authVersion = user.authVersion || 0;
            await currentSession.save({ session });
            return { user };
        });
        return res.json({ success: true, message: 'Cập nhật tài khoản thành công!',
            user: publicUser(result.user), csrfToken: issueCsrf(req, res) });
    } catch (error) {
        if ([400, 401].includes(error.status)) return res.status(error.status).json({ success: false,
            message: error.status === 400 ? 'Cần mật khẩu hiện tại chính xác để đổi email/mật khẩu.' : 'Phiên đăng nhập đã thay đổi.' });
        return failure(res, 'profile_update_failed', error);
    }
});
module.exports = router;
