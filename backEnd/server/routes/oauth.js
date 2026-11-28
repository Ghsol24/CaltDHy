'use strict';
// Đăng nhập bằng Google / Facebook. Được gắn vào /api/auth/oauth bởi routes/auth.js.
//
//   GET  /providers            nhà cung cấp nào đang bật (để giao diện ẩn/hiện nút)
//   GET  /:provider/start      tạo state, chuyển người dùng sang trang đăng nhập của nhà cung cấp
//   GET  /:provider/callback   nhà cung cấp trả người dùng về; quyết định đăng nhập / tạo mới / chờ xác nhận
//   GET  /pending              bước đang chờ người dùng xác nhận (nếu có)
//   POST /complete             xác nhận bằng mật khẩu CaltDHy và/hoặc mã 2FA rồi mới cấp phiên
//   POST /cancel               bỏ bước đang chờ
//   POST /:provider/link       (đã đăng nhập) xác nhận mật khẩu rồi chuyển sang nhà cung cấp để liên kết thêm
//   POST /:provider/unlink     (đã đăng nhập) gỡ liên kết, không cho gỡ cách đăng nhập cuối cùng
//
// Quy tắc quan trọng: một email trùng với tài khoản mật khẩu sẵn có KHÔNG BAO GIỜ được gộp tự động.
// Người dùng phải nhập đúng mật khẩu CaltDHy của tài khoản đó thì danh tính Google/Facebook mới được gắn vào.
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const User = require('../models/User');
const Invitation = require('../models/Invitation');
const Wallet = require('../models/Wallet');
const AuthSession = require('../models/AuthSession');
const { protect } = require('../middleware/authMiddleware');
const { runWithTransaction } = require('../utils/mongoTransaction');
const { createSession, setSession, revokeSession } = require('../utils/sessionSecurity');
const { publicUser } = require('../utils/publicUser');
const { PROVIDERS, providerConfig, enabledProviders, redirectBase, newAttempt, authorizationUrl, fetchProfile } = require('../utils/oauthProviders');
const { writeTicket, readTicket, clearTicket } = require('../utils/oauthTickets');

const USER_FIELDS = '+password +authVersion +oauth.googleId +oauth.facebookId';
const EXPIRED = 'Phiên liên kết đã hết hạn. Hãy đăng nhập lại bằng Google hoặc Facebook.';
// Ngôn ngữ giao diện lúc bấm nút: tài khoản mới tạo qua Google/Facebook nhận thông báo bằng đúng ngôn ngữ đó.
const LOCALES = ['vi', 'en', 'zh-CN'];
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const field = provider => 'oauth.' + provider + 'Id';
const sameText = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length &&
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
// Chỉ chuyển hướng tới các đường dẫn cố định trong chính ứng dụng: không có open redirect.
const backToLogin = (res, query) => res.redirect(303, '/login?' + query);
const fail = (res, code) => backToLogin(res, 'oauth_error=' + code);
// Kết quả liên kết từ Cài đặt quay về trong ứng dụng; giao diện mở lại đúng mục Dữ liệu & quyền riêng tư.
const linkResult = (res, provider, code) => res.redirect(303, '/spending/home?' + (code
    ? 'link_error=' + code + '&provider=' + provider : 'linked=' + provider));
// Câu trả lời cố định cho từng nhà cung cấp, để mỗi câu đều có bản dịch đã duyệt trong apiMessages.
const ALREADY_LINKED = { google: 'Tài khoản đã liên kết với Google.', facebook: 'Tài khoản đã liên kết với Facebook.' };
const UNLINKED = { google: 'Đã gỡ liên kết Google.', facebook: 'Đã gỡ liên kết Facebook.' };
const passwordOk = async (user, password) => typeof password === 'string' && password.length > 0 &&
    Buffer.byteLength(password, 'utf8') <= 72 && Boolean(user.password) && bcrypt.compare(password, user.password);

/**
 * Callback của một lần liên kết bắt đầu từ Cài đặt. Cookie phiên là SameSite=Strict nên không đi kèm lượt
 * điều hướng từ trang nhà cung cấp; thay vào đó, vé "attempt" (có chữ ký) ghi lại đúng phiên đã bắt đầu
 * liên kết, và phiên đó phải còn hiệu lực với cùng trạng thái mật khẩu.
 */
async function finishLink(req, res, config, attempt) {
    const provider = config.provider;
    const path = field(provider);
    const user = await User.findById(attempt.uid).select('+authVersion +' + path);
    const session = await AuthSession.findById(attempt.sid).lean();
    if (!user || !session || session.expiresAt <= new Date() || String(session.userId) !== String(user._id) ||
        session.authVersion !== (user.authVersion || 0) || (user.authVersion || 0) !== attempt.av) return linkResult(res, provider, 'expired');
    let profile;
    try { profile = await fetchProfile(config, req.query.code, attempt); } catch {
        console.error('[auth] oauth_exchange_failed');
        return linkResult(res, provider, 'failed');
    }
    const owner = await User.findOne({ [path]: profile.sub }).select('_id').lean();
    if (owner) return linkResult(res, provider, String(owner._id) === String(user._id) ? null : 'in_use');
    if (user.oauth?.[provider + 'Id']) return linkResult(res, provider, 'already');
    try {
        const updated = await User.updateOne({ _id: user._id, authVersion: user.authVersion ?? null, [path]: { $exists: false } },
            { $set: { [path]: profile.sub } });
        if (!updated.matchedCount) return linkResult(res, provider, 'expired');
    } catch (error) {
        if (error?.code === 11000) return linkResult(res, provider, 'in_use');
        throw error;
    }
    return linkResult(res, provider, null);
}

module.exports = function oauthRoutes({ consumeSecondFactor, TWO_FACTOR_FIELDS }) {
    const router = express.Router();

    router.get('/providers', (req, res) => {
        const base = redirectBase();
        res.json({ success: true, providers: enabledProviders(), origin: base ? new URL(base).origin : null });
    });

    router.get('/pending', async (req, res) => {
        try {
            const ticket = readTicket(req, 'pending');
            const user = ticket && await User.findById(ticket.uid).select('email +authVersion').lean();
            if (!user || (user.authVersion || 0) !== ticket.av) return res.json({ success: true, pending: null });
            return res.json({ success: true, pending: { kind: ticket.kind, provider: ticket.provider, email: user.email } });
        } catch {
            console.error('[auth] oauth_pending_failed');
            return res.status(500).json({ success: false, message: 'Không thể hoàn thành yêu cầu. Vui lòng thử lại.' });
        }
    });

    router.post('/cancel', (req, res) => {
        clearTicket(res, 'pending');
        res.json({ success: true });
    });

    router.get('/:provider/start', (req, res) => {
        const config = providerConfig(req.params.provider);
        if (!config) return fail(res, 'unavailable');
        try {
            const attempt = newAttempt();
            const invite = typeof req.query.invite === 'string' && /^[a-f0-9]{64}$/.test(req.query.invite) ? req.query.invite : null;
            const locale = LOCALES.includes(req.query.locale) ? req.query.locale : 'vi';
            clearTicket(res, 'pending');
            writeTicket(res, 'attempt', { provider: config.provider, ...attempt, invite, locale });
            return res.redirect(303, authorizationUrl(config, attempt));
        } catch {
            console.error('[auth] oauth_start_failed');
            return fail(res, 'failed');
        }
    });

    router.get('/:provider/callback', async (req, res) => {
        const config = providerConfig(req.params.provider);
        const attempt = readTicket(req, 'attempt');
        clearTicket(res, 'attempt');
        const linking = Boolean(config) && attempt?.mode === 'link' && attempt.provider === config.provider;
        const stop = code => (linking ? linkResult(res, config.provider, code) : fail(res, code));
        if (!config) return fail(res, 'unavailable');
        // Người dùng bấm "Huỷ" ở trang của nhà cung cấp.
        if (typeof req.query.error === 'string' && !req.query.code) return stop('cancelled');
        const { code, state } = req.query;
        if (!attempt || attempt.provider !== config.provider || !sameText(state, attempt.state) ||
            typeof code !== 'string' || !code || code.length > 4096) return stop('failed');
        if (linking) {
            try { return await finishLink(req, res, config, attempt); } catch {
                console.error('[auth] oauth_link_failed');
                return stop('failed');
            }
        }
        try {
            let profile;
            try { profile = await fetchProfile(config, code, attempt); } catch {
                console.error('[auth] oauth_exchange_failed');
                return fail(res, 'failed');
            }
            const provider = config.provider;

            // 1) Danh tính này đã được liên kết từ trước: đăng nhập (qua bước 2FA nếu tài khoản bật).
            const linked = await User.findOne({ [field(provider)]: profile.sub }).select('+authVersion twoFactor.enabled');
            if (linked) {
                if (linked.twoFactor?.enabled) {
                    writeTicket(res, 'pending', { kind: 'totp', provider, sub: profile.sub, uid: linked._id.toString(), av: linked.authVersion || 0 });
                    return backToLogin(res, 'oauth=verify');
                }
                const issued = await runWithTransaction(async session => {
                    await revokeSession(req, session);
                    return createSession(linked, session, req);
                });
                setSession(req, res, issued);
                return backToLogin(res, 'oauth=done');
            }

            if (!profile.email) return fail(res, 'no_email');
            if (provider === 'google' && !profile.emailVerified) return fail(res, 'email_unverified');

            // 2) Email trùng với một tài khoản sẵn có: không gộp tự động, chờ người dùng xác nhận bằng mật khẩu.
            const existing = await User.findOne({ email: profile.email }).select(USER_FIELDS);
            if (existing) {
                if (!existing.password) {
                    // Tài khoản này chỉ có đăng nhập mạng xã hội khác: không có mật khẩu để chứng minh quyền sở hữu.
                    return fail(res, existing.oauth?.googleId ? 'use_google' : 'use_facebook');
                }
                writeTicket(res, 'pending', { kind: 'link', provider, sub: profile.sub, uid: existing._id.toString(),
                    av: existing.authVersion || 0, ev: profile.emailVerified });
                return backToLogin(res, 'oauth=link');
            }

            // 3) Người dùng mới: tạo tài khoản không mật khẩu, cùng ví mặc định như đăng ký thường.
            const inviteOnly = req.app.locals.registrationMode === 'invite';
            if (inviteOnly && !attempt.invite) return fail(res, 'invite_required');
            const issued = await runWithTransaction(async session => {
                if (inviteOnly) {
                    const invitation = await Invitation.findOneAndUpdate({
                        tokenHash: sha256(attempt.invite), email: profile.email, expiresAt: { $gt: new Date() }, usedAt: null
                    }, { $set: { usedAt: new Date() } }, { session, new: true });
                    if (!invitation) { const error = new Error('Invalid invitation.'); error.code = 'INVITE_INVALID'; throw error; }
                }
                const [user] = await User.create([{
                    name: profile.name, email: profile.email, emailVerified: profile.emailVerified,
                    oauth: { [provider + 'Id']: profile.sub },
                    preferences: { notifications: { locale: LOCALES.includes(attempt.locale) ? attempt.locale : 'vi' } }
                }], { session });
                await Wallet.create([{ userId: user._id, name: 'Tiền mặt', type: 'cash', icon: '💵', initialBalance: 0, isDefault: true }], { session });
                await revokeSession(req, session);
                return createSession(user, session, req);
            });
            setSession(req, res, issued);
            // new=1 chỉ đổi lời chào ("Tạo tài khoản…") trên màn chào; người dùng tự biết điều này nên không lộ gì thêm.
            return backToLogin(res, 'oauth=done&new=1');
        } catch (error) {
            if (error?.code === 'INVITE_INVALID') return fail(res, 'invite_required');
            console.error('[auth] oauth_callback_failed');
            return fail(res, 'failed');
        }
    });

    // Liên kết thêm Google/Facebook cho tài khoản đang đăng nhập. Thêm một cách đăng nhập là thao tác nhạy cảm
    // (kẻ giữ được phiên có thể cài sẵn đường vào), nên tài khoản có mật khẩu phải nhập lại mật khẩu.
    router.post('/:provider/link', protect, async (req, res) => {
        try {
            const config = providerConfig(req.params.provider);
            if (!config) return res.status(404).json({ success: false, message: 'Cách đăng nhập này hiện chưa được bật.' });
            const user = await User.findById(req.user.id).select(USER_FIELDS);
            if (user.oauth?.[config.provider + 'Id']) {
                return res.status(409).json({ success: false, code: 'OAUTH_ALREADY_LINKED', message: ALREADY_LINKED[config.provider] });
            }
            if (user.password && !await passwordOk(user, req.body?.password)) {
                return res.status(400).json({ success: false, code: 'OAUTH_PASSWORD_INVALID', message: 'Mật khẩu hiện tại không đúng.' });
            }
            const attempt = newAttempt();
            writeTicket(res, 'attempt', { provider: config.provider, ...attempt, mode: 'link', uid: user._id.toString(),
                av: user.authVersion || 0, sid: req.authSession._id.toString() });
            return res.json({ success: true, url: authorizationUrl(config, attempt) });
        } catch {
            console.error('[auth] oauth_link_start_failed');
            return res.status(500).json({ success: false, message: 'Không thể hoàn thành yêu cầu. Vui lòng thử lại.' });
        }
    });

    router.post('/:provider/unlink', protect, async (req, res) => {
        try {
            const provider = req.params.provider;
            if (!PROVIDERS.includes(provider)) return res.status(404).json({ success: false, message: 'Cách đăng nhập này hiện chưa được bật.' });
            const user = await User.findById(req.user.id).select(USER_FIELDS);
            const sub = user.oauth?.[provider + 'Id'];
            if (!sub) return res.status(400).json({ success: false, code: 'OAUTH_NOT_LINKED', message: 'Tài khoản chưa liên kết cách đăng nhập này.' });
            const others = PROVIDERS.filter(other => other !== provider);
            if (user.password) {
                if (!await passwordOk(user, req.body?.password)) {
                    return res.status(400).json({ success: false, code: 'OAUTH_PASSWORD_INVALID', message: 'Mật khẩu hiện tại không đúng.' });
                }
            } else if (!others.some(other => user.oauth?.[other + 'Id'])) {
                // Gỡ cách đăng nhập cuối cùng sẽ khoá người dùng khỏi chính tài khoản của họ.
                return res.status(400).json({ success: false, code: 'LAST_SIGNIN_METHOD', message: 'Đây là cách đăng nhập duy nhất. Hãy tạo mật khẩu trước khi gỡ.' });
            }
            // Ghi có điều kiện trên đúng trạng thái vừa kiểm tra: hai lần gỡ đồng thời không thể cùng vượt qua quy tắc trên.
            const guard = user.password ? { password: user.password }
                : Object.fromEntries(others.map(other => [field(other), user.oauth?.[other + 'Id'] ?? null]));
            const updated = await User.updateOne({ _id: user._id, [field(provider)]: sub, ...guard }, { $unset: { [field(provider)]: '' } });
            if (!updated.modifiedCount) return res.status(409).json({ success: false, message: 'Phiên đăng nhập đã thay đổi.' });
            const fresh = await User.findById(user._id)
                .select('name email avatar emailVerified preferences twoFactor.enabled ' + USER_FIELDS).lean();
            return res.json({ success: true, message: UNLINKED[provider], user: publicUser(fresh) });
        } catch {
            console.error('[auth] oauth_unlink_failed');
            return res.status(500).json({ success: false, message: 'Không thể hoàn thành yêu cầu. Vui lòng thử lại.' });
        }
    });

    router.post('/complete', async (req, res) => {
        try {
            const ticket = readTicket(req, 'pending');
            const expired = () => { clearTicket(res, 'pending'); return res.status(400).json({ success: false, code: 'OAUTH_EXPIRED', message: EXPIRED }); };
            if (!ticket || !PROVIDERS.includes(ticket.provider) || !['link', 'totp'].includes(ticket.kind)) return expired();
            const { password, totpCode } = req.body || {};
            const path = field(ticket.provider);
            const user = await User.findById(ticket.uid).select(USER_FIELDS + ' ' + TWO_FACTOR_FIELDS);
            const current = user?.oauth?.[ticket.provider + 'Id'];
            // Vé chỉ dùng được với đúng trạng thái tài khoản lúc nó được cấp.
            if (!user || (user.authVersion || 0) !== ticket.av ||
                (ticket.kind === 'totp' ? current !== ticket.sub : Boolean(current) && current !== ticket.sub)) return expired();

            if (ticket.kind === 'link') {
                if (typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72 ||
                    !user.password || !await bcrypt.compare(password, user.password)) {
                    return res.status(401).json({ success: false, code: 'OAUTH_PASSWORD_INVALID', message: 'Mật khẩu không đúng.' });
                }
            }
            // Liên kết Google/Facebook không được trở thành đường vòng qua xác thực hai lớp.
            if (user.twoFactor?.enabled) {
                if (totpCode === undefined || totpCode === null || totpCode === '') {
                    return res.status(401).json({ success: false, code: 'TOTP_REQUIRED', message: 'Nhập mã 6 số từ ứng dụng xác thực để tiếp tục.' });
                }
                if (!await consumeSecondFactor(user, totpCode)) {
                    return res.status(401).json({ success: false, code: 'TOTP_INVALID', message: 'Mã xác thực không đúng hoặc đã hết hạn.' });
                }
            }

            const issued = await runWithTransaction(async session => {
                if (ticket.kind === 'link' && !current) {
                    const updated = await User.updateOne(
                        { _id: user._id, authVersion: user.authVersion ?? null, [path]: { $exists: false } },
                        { $set: { [path]: ticket.sub, ...(ticket.ev === true ? { emailVerified: true } : {}) },
                            ...(ticket.ev === true ? { $unset: { emailVerificationToken: '', emailVerificationExpiry: '' } } : {}) },
                        { session });
                    if (!updated.matchedCount) { const error = new Error('Account changed.'); error.code = 'OAUTH_STALE'; throw error; }
                    user.set(path, ticket.sub);
                    if (ticket.ev === true) user.emailVerified = true;
                }
                await revokeSession(req, session);
                return createSession(user, session, req);
            });
            clearTicket(res, 'pending');
            return res.json({ success: true, message: ticket.kind === 'link' ? 'Liên kết tài khoản thành công!' : 'Đăng nhập thành công!',
                user: publicUser(user), csrfToken: setSession(req, res, issued) });
        } catch (error) {
            if (error?.code === 'OAUTH_STALE') {
                clearTicket(res, 'pending');
                return res.status(400).json({ success: false, code: 'OAUTH_EXPIRED', message: EXPIRED });
            }
            console.error('[auth] oauth_complete_failed');
            // 11000: danh tính Google/Facebook này vừa được gắn vào một tài khoản khác.
            if (error?.code === 11000) return res.status(409).json({ success: false, message: 'Tài khoản Google/Facebook này đã được liên kết với một tài khoản CaltDHy khác.' });
            return res.status(500).json({ success: false, message: 'Không thể hoàn thành yêu cầu. Vui lòng thử lại.' });
        }
    });

    return router;
};
