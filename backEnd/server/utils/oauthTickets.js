'use strict';
// Hai cookie ngắn hạn (10 phút), có chữ ký HMAC, phục vụ đăng nhập bằng Google / Facebook:
//  - "attempt": giữ state/nonce/PKCE giữa lúc rời sang nhà cung cấp và lúc callback quay về.
//    Phải là SameSite=Lax vì callback là một lượt điều hướng đến từ trang của nhà cung cấp.
//  - "pending": danh tính đã được nhà cung cấp xác nhận nhưng CHƯA được đăng nhập, vì còn chờ
//    người dùng nhập mật khẩu CaltDHy (liên kết tài khoản) hoặc mã 2FA. SameSite=Strict.
const crypto = require('node:crypto');
const { secureCookies } = require('./sessionSecurity');

const LIFETIME_MS = 10 * 60 * 1000;
const cookieName = kind => (secureCookies() ? '__Host-' : '') + 'caltdhy_oauth_' + kind;
const options = kind => ({ httpOnly: true, secure: secureCookies(), sameSite: kind === 'attempt' ? 'lax' : 'strict', path: '/' });

function sign(kind, body) {
    if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32) throw new Error('Session key is not configured.');
    return crypto.createHmac('sha256', process.env.JWT_SECRET).update('oauth\0' + kind + '\0' + body).digest('base64url');
}

function writeTicket(res, kind, payload) {
    const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + LIFETIME_MS }), 'utf8').toString('base64url');
    res.cookie(cookieName(kind), body + '.' + sign(kind, body), { ...options(kind), maxAge: LIFETIME_MS });
}

function readTicket(req, kind) {
    const name = cookieName(kind);
    const matches = (req.headers.cookie || '').split(';').map(value => value.trim()).filter(value => value.startsWith(name + '='));
    if (matches.length !== 1) return null;
    const value = matches[0].slice(name.length + 1);
    if (value.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)) return null;
    const [body, signature] = value.split('.');
    const expected = sign(kind, body);
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        return payload && typeof payload === 'object' && typeof payload.exp === 'number' && payload.exp > Date.now() ? payload : null;
    } catch { return null; }
}

const clearTicket = (res, kind) => res.clearCookie(cookieName(kind), options(kind));

module.exports = { writeTicket, readTicket, clearTicket };
