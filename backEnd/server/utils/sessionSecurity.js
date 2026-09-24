'use strict';
const crypto = require('node:crypto');
const AuthSession = require('../models/AuthSession');

function secureCookies() {
    return process.env.COOKIE_SECURE === 'true' ||
        /^https:\/\//.test(process.env.CLIENT_URL || '') ||
        !['127.0.0.1', '::1'].includes(process.env.HOST || '127.0.0.1');
}
function names() {
    const prefix = secureCookies() ? '__Host-' : '';
    return { session: prefix + 'caltdhy_session', csrf: prefix + 'caltdhy_csrf' };
}
function cookieOptions() {
    return { httpOnly: true, secure: secureCookies(), sameSite: 'strict', path: '/' };
}
function readCookie(req, name) {
    const matches = (req.headers.cookie || '').split(';').map(value => value.trim())
        .filter(value => value.startsWith(name + '='));
    if (matches.length !== 1) return null;
    const value = matches[0].slice(name.length + 1);
    return /^[a-f0-9]{64}$/.test(value) ? value : null;
}
const hash = value => crypto.createHmac('sha256', process.env.JWT_SECRET).update('session\0' + value).digest('hex');
const sessionToken = req => readCookie(req, names().session);
function sessionLifetime() {
    const match = /^([1-9]\d*)([smhd])$/.exec(process.env.JWT_EXPIRES_IN || '1h');
    const seconds = match && Number(match[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[match[2]];
    if (!Number.isSafeInteger(seconds) || seconds < 60 || seconds > 604800) {
        throw new Error('Invalid session lifetime.');
    }
    return seconds * 1000;
}
function csrfValue(nonce, token) {
    if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32) {
        throw new Error('Session key is not configured.');
    }
    return crypto.createHmac('sha256', process.env.JWT_SECRET)
        .update('csrf\0' + nonce + '\0' + (token || 'anonymous')).digest('hex');
}
function issueCsrf(req, res, token = sessionToken(req)) {
    const nonce = readCookie(req, names().csrf) || crypto.randomBytes(32).toString('hex');
    res.cookie(names().csrf, nonce, { ...cookieOptions(), maxAge: sessionLifetime() });
    return csrfValue(nonce, token);
}
function csrfProtection(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const nonce = readCookie(req, names().csrf);
    const supplied = req.get('X-CSRF-Token');
    if (!nonce || typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied) ||
        req.get('Sec-Fetch-Site') === 'cross-site' ||
        !crypto.timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(csrfValue(nonce, sessionToken(req)), 'hex'))) {
        return res.status(403).json({ success: false, code: 'CSRF_INVALID', message: 'Phiên xác thực yêu cầu đã thay đổi. Vui lòng thử lại.' });
    }
    return next();
}
async function createSession(user, session) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + sessionLifetime());
    await AuthSession.create([{
        tokenHash: hash(token), userId: user._id, authVersion: user.authVersion || 0, expiresAt
    }], session ? { session } : {});
    return { token, expiresAt };
}
function setSession(req, res, issued) {
    res.cookie(names().session, issued.token, { ...cookieOptions(), expires: issued.expiresAt });
    return issueCsrf(req, res, issued.token);
}
async function revokeSession(req, session) {
    const token = sessionToken(req);
    if (token) await AuthSession.deleteOne({ tokenHash: hash(token) }, session ? { session } : {});
}
function clearSession(res) {
    res.clearCookie(names().session, cookieOptions());
    res.clearCookie(names().csrf, cookieOptions());
}
module.exports = {
    hash, sessionToken, sessionLifetime, issueCsrf, csrfProtection,
    createSession, setSession, revokeSession, clearSession, secureCookies
};
