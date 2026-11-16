'use strict';
// Đăng nhập bằng Google / Facebook theo luồng "authorization code" chạy hoàn toàn phía server:
// trình duyệt chỉ được chuyển hướng, không tải script của bên thứ ba và không bao giờ thấy
// client secret hay access token. Vì vậy CSP hiện tại (script-src 'self') được giữ nguyên.
const crypto = require('node:crypto');
const { validEmail, normalizeEmail } = require('./emailAddress');

const PROVIDERS = ['google', 'facebook'];
const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];
const TIMEOUT_MS = 10000;

/** Gốc URL công khai của ứng dụng (lấy từ CLIENT_URL); callback của nhà cung cấp quay về đây. */
function redirectBase() {
    const configured = process.env.CLIENT_URL;
    if (typeof configured !== 'string' || !/^https?:\/\//.test(configured)) return null;
    let base;
    try { base = new URL(configured); } catch { return null; }
    if (base.username || base.password || base.search || base.hash) return null;
    // HTTP chỉ hợp lệ khi quay về chính máy đang chạy ứng dụng.
    if (base.protocol !== 'https:' && !LOOPBACK.includes(base.hostname)) return null;
    return base.origin + base.pathname.replace(/\/+$/, '');
}

function graphVersion() {
    const version = process.env.FACEBOOK_GRAPH_VERSION || 'v26.0';
    return /^v\d{1,3}\.\d$/.test(version) ? version : 'v26.0';
}

function providerConfig(provider) {
    const base = redirectBase();
    if (!base || !PROVIDERS.includes(provider)) return null;
    const [id, secret] = provider === 'google'
        ? [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET]
        : [process.env.FACEBOOK_APP_ID, process.env.FACEBOOK_APP_SECRET];
    if (typeof id !== 'string' || !id.trim() || typeof secret !== 'string' || !secret.trim()) return null;
    return {
        provider, clientId: id.trim(), clientSecret: secret.trim(),
        origin: new URL(base).origin,
        redirectUri: base + '/api/auth/oauth/' + provider + '/callback'
    };
}

const enabledProviders = () => PROVIDERS.filter(provider => providerConfig(provider));

/** Giá trị ngẫu nhiên của một lần đăng nhập; được lưu trong cookie đã ký cho tới khi callback quay về. */
function newAttempt() {
    return {
        state: crypto.randomBytes(32).toString('hex'),
        nonce: crypto.randomBytes(16).toString('hex'),
        verifier: crypto.randomBytes(32).toString('base64url')
    };
}

function authorizationUrl(config, attempt) {
    if (config.provider === 'google') {
        const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        url.search = new URLSearchParams({
            client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code',
            scope: 'openid email profile', state: attempt.state, nonce: attempt.nonce,
            code_challenge: crypto.createHash('sha256').update(attempt.verifier).digest('base64url'),
            code_challenge_method: 'S256', prompt: 'select_account'
        }).toString();
        return url.toString();
    }
    const url = new URL('https://www.facebook.com/' + graphVersion() + '/dialog/oauth');
    url.search = new URLSearchParams({
        client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code',
        scope: 'email,public_profile', state: attempt.state
    }).toString();
    return url.toString();
}

async function readJson(url, options) {
    const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || typeof body !== 'object') throw new Error('Provider request failed.');
    return body;
}

function cleanProfile(sub, email, emailVerified, name) {
    if (typeof sub !== 'string' || !/^[A-Za-z0-9._-]{1,255}$/.test(sub)) throw new Error('Provider identity missing.');
    const usable = validEmail(email);
    const display = typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 100) : '';
    return {
        sub, email: usable ? normalizeEmail(email) : null,
        emailVerified: usable && emailVerified === true,
        name: display || (usable ? normalizeEmail(email).split('@')[0].slice(0, 100) : '')
    };
}

async function googleProfile(config, code, attempt) {
    const token = await readJson('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({
            code, client_id: config.clientId, client_secret: config.clientSecret,
            redirect_uri: config.redirectUri, grant_type: 'authorization_code', code_verifier: attempt.verifier
        }).toString()
    });
    // ID token nhận trực tiếp từ token endpoint của Google qua TLS, đổi bằng client secret của chính
    // ứng dụng, nên kênh truyền đã xác thực nguồn phát hành (OpenID Connect Core 3.1.3.7). Các claim
    // vẫn được kiểm tra đầy đủ: bên phát hành, ứng dụng nhận, hạn dùng và nonce của lần đăng nhập này.
    const parts = typeof token.id_token === 'string' ? token.id_token.split('.') : [];
    if (parts.length !== 3) throw new Error('Provider token missing.');
    let claims;
    try { claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { throw new Error('Provider token invalid.'); }
    if (!claims || !['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss) ||
        claims.aud !== config.clientId || typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now() ||
        claims.nonce !== attempt.nonce) throw new Error('Provider token rejected.');
    return cleanProfile(claims.sub, claims.email, claims.email_verified === true || claims.email_verified === 'true', claims.name);
}

async function facebookProfile(config, code) {
    const graph = 'https://graph.facebook.com/' + graphVersion();
    const token = await readJson(graph + '/oauth/access_token?' + new URLSearchParams({
        client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, code
    }).toString(), { headers: { accept: 'application/json' } });
    if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('Provider token missing.');
    const proof = crypto.createHmac('sha256', config.clientSecret).update(token.access_token).digest('hex');
    const profile = await readJson(graph + '/me?' + new URLSearchParams({
        fields: 'id,name,email', appsecret_proof: proof
    }).toString(), { headers: { accept: 'application/json', authorization: 'Bearer ' + token.access_token } });
    // Facebook không cho biết email đã được xác minh hay chưa, nên không bao giờ coi là đã xác minh.
    return cleanProfile(profile.id, profile.email, false, profile.name);
}

/** Đổi mã uỷ quyền lấy danh tính: { sub, email|null, emailVerified, name }. Lỗi luôn là thông báo chung. */
function fetchProfile(config, code, attempt) {
    return config.provider === 'google' ? googleProfile(config, code, attempt) : facebookProfile(config, code);
}

module.exports = { PROVIDERS, providerConfig, enabledProviders, redirectBase, newAttempt, authorizationUrl, fetchProfile };
