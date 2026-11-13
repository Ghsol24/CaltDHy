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
const { publicPreferences, publicUser } = require('../utils/publicUser');
const { validPreferencesUpdate, preferenceUpdateFields } = require('../utils/cashFlowPreferences');
const PushSubscription = require('../models/PushSubscription');
const { validPushEndpoint, vapidConfig } = require('../utils/webPush');
const { applyReminderChoice } = require('../utils/reminders');
const totp = require('../utils/totp');
const router = express.Router();

const validPassword = value => typeof value === 'string' && value.length >= 12 &&
    Buffer.byteLength(value, 'utf8') <= 72;
const validToken = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const avatarPresets = new Set(['💼', '🚀', '⚡', '🎯', '👑', '💎', '🏆', '☕', '🦁', '🦊', '🐱', '🌲', '🍀', '🛸', '🎮', '💻']);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
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

const TWO_FACTOR_FIELDS = '+twoFactor.secret +twoFactor.pendingSecret +twoFactor.lastStep +twoFactor.recoveryCodes';
/**
 * Accepts a current authenticator code or an unused recovery code, and marks it used with a
 * conditional write so the same code can never be accepted twice, even by concurrent requests.
 */
async function consumeSecondFactor(user, supplied) {
    if (typeof supplied !== 'string' || supplied.length > 40 || !user.twoFactor?.secret) return false;
    const code = supplied.replace(/\s/g, '');
    if (/^\d{6}$/.test(code)) {
        const lastStep = user.twoFactor.lastStep || 0;
        const step = totp.verifyCode(totp.decryptSecret(user.twoFactor.secret), code, { lastStep });
        if (!step) return false;
        const updated = await User.updateOne({ _id: user._id, 'twoFactor.enabled': true,
            $or: [{ 'twoFactor.lastStep': { $lt: step } }, { 'twoFactor.lastStep': { $exists: false } }] },
        { $set: { 'twoFactor.lastStep': step } });
        return updated.modifiedCount === 1;
    }
    if (totp.normalizeRecoveryCode(code).length !== 10) return false;
    const hashed = totp.hashRecoveryCode(code);
    const updated = await User.updateOne({ _id: user._id, 'twoFactor.enabled': true, 'twoFactor.recoveryCodes': hashed },
        { $pull: { 'twoFactor.recoveryCodes': hashed } });
    return updated.modifiedCount === 1;
}
async function passwordMatches(userId, supplied) {
    if (typeof supplied !== 'string' || !supplied || Buffer.byteLength(supplied, 'utf8') > 72) return null;
    const user = await User.findById(userId).select('+password ' + TWO_FACTOR_FIELDS);
    return user && await bcrypt.compare(supplied, user.password) ? user : null;
}
const WRONG_PASSWORD = 'Mật khẩu hiện tại không đúng.';

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
            return { user, issued: await createSession(user, session, req) };
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
        const { email, password, totpCode } = req.body || {};
        if (!validEmail(email) || typeof password !== 'string' || password.length === 0 ||
            Buffer.byteLength(password, 'utf8') > 72) {
            return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không hợp lệ.' });
        }
        const user = await User.findOne({ email: normalizeEmail(email) }).select('+password +authVersion ' + TWO_FACTOR_FIELDS);
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
        }
        // Lớp thứ hai chỉ được hỏi sau khi mật khẩu đúng, nên không lộ tài khoản nào đang bật 2FA.
        if (user.twoFactor?.enabled) {
            if (totpCode === undefined || totpCode === null || totpCode === '') {
                return res.status(401).json({ success: false, code: 'TOTP_REQUIRED',
                    message: 'Nhập mã 6 số từ ứng dụng xác thực để tiếp tục.' });
            }
            if (!await consumeSecondFactor(user, totpCode)) {
                return res.status(401).json({ success: false, code: 'TOTP_INVALID',
                    message: 'Mã xác thực không đúng hoặc đã hết hạn.' });
            }
        }
        const issued = await runWithTransaction(async session => {
            await revokeSession(req, session);
            return createSession(user, session, req);
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
        const user = await User.findOne({ email: normalizeEmail(email) }).select('+authVersion').lean();
        if (!user || (verification && user.emailVerified)) return res.json(generic);
        const token = crypto.randomBytes(32).toString('hex');
        const link = buildAccountLink(verification ? 'verify-email' : 'reset-password', token, user.email);
        const tokenField = verification ? 'emailVerificationToken' : 'resetPasswordToken';
        const expiryField = verification ? 'emailVerificationExpiry' : 'resetPasswordExpiry';
        // Do not install a token for a stale email/credential snapshot. A profile
        // change or reset may have committed after the lookup above.
        // Matching null also supports legacy accounts without authVersion.
        const updated = await User.updateOne({
            _id: user._id, email: user.email, authVersion: user.authVersion ?? null,
            ...(verification ? { emailVerified: { $ne: true } } : {})
        }, { $set: {
            [tokenField]: hash(token), [expiryField]: new Date(Date.now() + (verification ? 86400000 : 900000))
        } });
        if (!updated.matchedCount) return res.json(generic);
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

router.put('/preferences', protect, async (req, res) => {
    const body = req.body;
    if (!validPreferencesUpdate(body)) {
        return res.status(400).json({ success: false, message: 'Tùy chọn tài khoản không hợp lệ.' });
    }
    try {
        const user = await User.findOneAndUpdate(
            { _id: req.user.id },
            { $set: preferenceUpdateFields(body, req.user.preferences) },
            { new: true, runValidators: true, projection: { preferences: 1 } }
        ).lean();
        if (!user) {
            return res.status(401).json({ success: false, code: 'SESSION_EXPIRED',
                message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.' });
        }
        return res.json({ success: true, preferences: publicPreferences(user.preferences) });
    } catch (error) { return failure(res, 'preferences_update_failed', error); }
});

// Trang "tạm dừng / tắt email nhắc" mở từ link trong email: không cần đăng nhập, chỉ cần mã có chữ ký.
router.post('/email-reminders', async (req, res) => {
    try {
        const { token, action } = req.body || {};
        if (!await applyReminderChoice(token, action)) {
            return res.status(400).json({ success: false, message: 'Liên kết quản lý email không hợp lệ.' });
        }
        return res.json({ success: true, message: 'Đã cập nhật lựa chọn email nhắc.' });
    } catch (error) { return failure(res, 'email_reminders_failed', error); }
});

// Thông báo đẩy: khóa công khai để trình duyệt đăng ký, và danh sách thiết bị của tài khoản.
router.get('/push-config', protect, (req, res) => {
    res.json({ success: true, publicKey: vapidConfig()?.publicKey || null });
});
router.post('/push-subscriptions', protect, async (req, res) => {
    try {
        const endpoint = req.body?.endpoint;
        if (!vapidConfig()) return res.status(503).json({ success: false, message: 'Thông báo đẩy chưa được cấu hình.' });
        if (!validPushEndpoint(endpoint)) return res.status(400).json({ success: false, message: 'Thiết bị đăng ký thông báo không hợp lệ.' });
        const mine = await PushSubscription.find({ userId: req.user.id }).sort({ createdAt: 1 }).select('endpoint').lean();
        if (!mine.some(item => item.endpoint === endpoint)) {
            // Giữ tối đa 10 thiết bị; thiết bị cũ nhất nhường chỗ.
            if (mine.length >= 10) await PushSubscription.deleteOne({ _id: mine[0]._id });
            // Một endpoint thuộc về tài khoản đăng nhập gần nhất trên trình duyệt đó.
            await PushSubscription.findOneAndUpdate({ endpoint }, { $set: { userId: req.user.id } }, { upsert: true });
        }
        return res.json({ success: true });
    } catch (error) { return failure(res, 'push_subscribe_failed', error); }
});
router.post('/push-subscriptions/remove', protect, async (req, res) => {
    try {
        if (typeof req.body?.endpoint === 'string') {
            await PushSubscription.deleteOne({ userId: req.user.id, endpoint: req.body.endpoint });
        }
        return res.json({ success: true });
    } catch (error) { return failure(res, 'push_unsubscribe_failed', error); }
});

// =============================================
// Thiết bị đang đăng nhập
// =============================================
router.get('/sessions', protect, async (req, res) => {
    try {
        const sessions = await AuthSession.find({ userId: req.user.id, expiresAt: { $gt: new Date() } })
            .select('userAgent createdAt lastSeenAt expiresAt authVersion').sort({ lastSeenAt: -1 }).lean();
        // Phiên có authVersion cũ đã vô hiệu (đổi mật khẩu) nhưng chưa bị TTL dọn: không liệt kê.
        const live = sessions.filter(session => session.authVersion === req.authSession.authVersion);
        return res.json({ success: true, data: live.map(session => ({
            id: session._id.toString(), current: session._id.toString() === req.authSession._id.toString(),
            userAgent: session.userAgent || '', createdAt: session.createdAt,
            lastSeenAt: session.lastSeenAt || session.createdAt, expiresAt: session.expiresAt
        })) });
    } catch (error) { return failure(res, 'sessions_list_failed', error); }
});
router.post('/sessions/revoke', protect, async (req, res) => {
    try {
        const id = req.body?.id;
        if (typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id)) {
            return res.status(400).json({ success: false, message: 'Phiên đăng nhập không hợp lệ.' });
        }
        if (id === req.authSession._id.toString()) {
            return res.status(400).json({ success: false, message: 'Để thoát thiết bị này, hãy dùng nút Đăng xuất.' });
        }
        const result = await AuthSession.deleteOne({ _id: id, userId: req.user.id });
        if (!result.deletedCount) return res.status(404).json({ success: false, message: 'Phiên đăng nhập không còn tồn tại.' });
        return res.json({ success: true, message: 'Đã đăng xuất thiết bị đó.' });
    } catch (error) { return failure(res, 'session_revoke_failed', error); }
});
router.post('/sessions/revoke-others', protect, async (req, res) => {
    try {
        const result = await AuthSession.deleteMany({ userId: req.user.id, _id: { $ne: req.authSession._id } });
        return res.json({ success: true, message: 'Đã đăng xuất các thiết bị khác.', revoked: result.deletedCount });
    } catch (error) { return failure(res, 'session_revoke_others_failed', error); }
});

// =============================================
// Xác thực hai lớp (TOTP)
// =============================================
router.post('/2fa/setup', protect, async (req, res) => {
    try {
        const user = await passwordMatches(req.user.id, req.body?.currentPassword);
        if (!user) return res.status(400).json({ success: false, message: WRONG_PASSWORD });
        if (user.twoFactor?.enabled) {
            return res.status(409).json({ success: false, message: 'Xác thực hai lớp đang bật. Hãy tắt trước khi thiết lập lại.' });
        }
        const secret = totp.generateSecret();
        await User.updateOne({ _id: user._id }, { $set: { 'twoFactor.pendingSecret': totp.encryptSecret(secret) } });
        return res.json({ success: true, secret, otpauthUri: totp.otpauthUri(secret, user.email) });
    } catch (error) { return failure(res, 'two_factor_setup_failed', error); }
});
router.post('/2fa/enable', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select(TWO_FACTOR_FIELDS);
        const code = typeof req.body?.code === 'string' ? req.body.code.replace(/\s/g, '') : '';
        if (!user?.twoFactor?.pendingSecret || user.twoFactor.enabled) {
            return res.status(400).json({ success: false, message: 'Hãy bắt đầu thiết lập xác thực hai lớp trước.' });
        }
        const step = totp.verifyCode(totp.decryptSecret(user.twoFactor.pendingSecret), code);
        if (!step) return res.status(400).json({ success: false, message: 'Mã xác thực không đúng hoặc đã hết hạn.' });
        const recoveryCodes = totp.generateRecoveryCodes();
        const updated = await User.updateOne(
            { _id: user._id, 'twoFactor.pendingSecret': user.twoFactor.pendingSecret, 'twoFactor.enabled': { $ne: true } },
            { $set: { 'twoFactor.enabled': true, 'twoFactor.secret': user.twoFactor.pendingSecret,
                'twoFactor.lastStep': step, 'twoFactor.recoveryCodes': recoveryCodes.map(totp.hashRecoveryCode) },
            $unset: { 'twoFactor.pendingSecret': '' } });
        if (!updated.modifiedCount) return res.status(409).json({ success: false, message: 'Phiên đăng nhập đã thay đổi.' });
        // Thiết bị khác phải đăng nhập lại bằng lớp thứ hai; thiết bị đang thao tác được giữ.
        await AuthSession.deleteMany({ userId: user._id, _id: { $ne: req.authSession._id } });
        return res.json({ success: true, message: 'Đã bật xác thực hai lớp.', recoveryCodes });
    } catch (error) { return failure(res, 'two_factor_enable_failed', error); }
});
router.post('/2fa/disable', protect, async (req, res) => {
    try {
        const user = await passwordMatches(req.user.id, req.body?.currentPassword);
        if (!user) return res.status(400).json({ success: false, message: WRONG_PASSWORD });
        if (!user.twoFactor?.enabled) {
            await User.updateOne({ _id: user._id }, { $unset: { 'twoFactor.pendingSecret': '' } });
            return res.json({ success: true, message: 'Đã tắt xác thực hai lớp.' });
        }
        if (!await consumeSecondFactor(user, req.body?.code)) {
            return res.status(400).json({ success: false, message: 'Mã xác thực không đúng hoặc đã hết hạn.' });
        }
        await User.updateOne({ _id: user._id }, { $set: { 'twoFactor.enabled': false, 'twoFactor.lastStep': 0 },
            $unset: { 'twoFactor.secret': '', 'twoFactor.pendingSecret': '', 'twoFactor.recoveryCodes': '' } });
        return res.json({ success: true, message: 'Đã tắt xác thực hai lớp.' });
    } catch (error) { return failure(res, 'two_factor_disable_failed', error); }
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
            if (newPassword || changedEmail) {
                // Rotate the credential itself: upgrading the old session's
                // authVersion would also preserve every stolen copy of it.
                await AuthSession.deleteOne({ _id: currentSession._id }, { session });
                return { user, issued: await createSession(user, session, req) };
            }
            return { user };
        });
        return res.json({ success: true, message: 'Cập nhật tài khoản thành công!',
            user: publicUser(result.user),
            csrfToken: result.issued ? setSession(req, res, result.issued) : issueCsrf(req, res) });
    } catch (error) {
        if ([400, 401].includes(error.status)) return res.status(error.status).json({ success: false,
            message: error.status === 400 ? 'Cần mật khẩu hiện tại chính xác để đổi email/mật khẩu.' : 'Phiên đăng nhập đã thay đổi.' });
        return failure(res, 'profile_update_failed', error);
    }
});
module.exports = router;
