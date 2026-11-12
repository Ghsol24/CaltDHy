'use strict';
// Web Push không kèm nội dung: chỉ cần chữ ký VAPID (RFC 8292), không cần mã hóa payload,
// nên không phụ thuộc thư viện ngoài. Service worker tự hiển thị lời nhắc khi nhận tín hiệu.
const crypto = require('node:crypto');

// Chỉ gửi tới máy chủ đẩy của các trình duyệt: endpoint do client cung cấp, không được
// trở thành cách để server gọi tới một địa chỉ tùy ý.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/,
    /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

function validPushEndpoint(value) {
    if (typeof value !== 'string' || value.length > 1000) return false;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
            PUSH_HOSTS.some(pattern => pattern.test(url.hostname));
    } catch { return false; }
}

const fromBase64Url = value => Buffer.from(String(value || ''), 'base64url');

function vapidConfig() {
    const publicKey = process.env.VAPID_PUBLIC_KEY, privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) return null;
    const point = fromBase64Url(publicKey), secret = fromBase64Url(privateKey);
    if (point.length !== 65 || point[0] !== 4 || secret.length !== 32) return null;
    let subject = process.env.VAPID_SUBJECT;
    if (!subject && /^https:\/\//.test(process.env.CLIENT_URL || '')) subject = new URL(process.env.CLIENT_URL).origin;
    if (!subject && (process.env.EMAIL_FROM || process.env.GMAIL_USER)) subject = 'mailto:' + (process.env.EMAIL_FROM || process.env.GMAIL_USER);
    if (!subject || !/^(mailto:|https:\/\/)/.test(subject)) return null;
    try {
        const key = crypto.createPrivateKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256',
            d: secret.toString('base64url'), x: point.subarray(1, 33).toString('base64url'), y: point.subarray(33).toString('base64url') } });
        return { publicKey: point.toString('base64url'), key, subject };
    } catch { return null; }
}

function vapidAuthorization(endpoint, config, now = Date.now()) {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = encode({ typ: 'JWT', alg: 'ES256' }) + '.' +
        encode({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 60 * 60, sub: config.subject });
    const signature = crypto.sign('sha256', Buffer.from(unsigned), { key: config.key, dsaEncoding: 'ieee-p1363' });
    return 'vapid t=' + unsigned + '.' + signature.toString('base64url') + ', k=' + config.publicKey;
}

/** Trả về 'sent', 'gone' (thiết bị đã hủy đăng ký, nên xóa) hoặc 'failed'. */
async function sendPush(endpoint, config = vapidConfig()) {
    if (!config || !validPushEndpoint(endpoint)) return 'failed';
    try {
        const response = await fetch(endpoint, {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
            headers: { TTL: '14400', Urgency: 'normal', 'Content-Length': '0', Authorization: vapidAuthorization(endpoint, config) }
        });
        if (response.status === 404 || response.status === 410) return 'gone';
        return response.ok ? 'sent' : 'failed';
    } catch { return 'failed'; }
}

module.exports = { validPushEndpoint, vapidConfig, vapidAuthorization, sendPush };
