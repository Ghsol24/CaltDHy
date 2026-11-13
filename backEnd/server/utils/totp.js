'use strict';
// TOTP (RFC 6238, SHA-1, 6 digits, 30 s) with node:crypto only, compatible with
// Google Authenticator, Microsoft Authenticator, Authy, 1Password and similar apps.
const crypto = require('node:crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;

function base32Encode(buffer) {
    let bits = '';
    for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
    let output = '';
    for (let index = 0; index < bits.length; index += 5) {
        output += ALPHABET[parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
    }
    return output;
}
function base32Decode(value) {
    let bits = '';
    for (const char of String(value).toUpperCase().replace(/[\s=-]/g, '')) {
        const index = ALPHABET.indexOf(char);
        if (index < 0) throw new Error('Invalid base32 value.');
        bits += index.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
    return Buffer.from(bytes);
}

const generateSecret = () => base32Encode(crypto.randomBytes(20));
const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

function codeAt(secret, step) {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));
    const digest = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}

/**
 * Returns the matching time step, or null. Accepts one step either side for clock drift and
 * refuses any step at or before `lastStep`, so an observed code cannot be replayed.
 */
function verifyCode(secret, code, { lastStep = 0, now = Date.now() } = {}) {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
    const supplied = Buffer.from(code);
    const step = currentStep(now);
    for (const candidate of [step, step - 1, step + 1]) {
        if (candidate <= lastStep) continue;
        if (crypto.timingSafeEqual(supplied, Buffer.from(codeAt(secret, candidate)))) return candidate;
    }
    return null;
}

function key() {
    const secret = process.env.JWT_SECRET;
    if (!secret || Buffer.byteLength(secret) < 32) throw new Error('Session key is not configured.');
    return crypto.createHmac('sha256', secret).update('totp-secret\0v1').digest();
}
/** The authenticator secret is encrypted at rest; a database dump alone cannot produce codes. */
function encryptSecret(secret) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
    const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map(part => part.toString('base64url')).join('.');
}
function decryptSecret(stored) {
    const [iv, tag, data] = String(stored).split('.').map(part => Buffer.from(part, 'base64url'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

const normalizeRecoveryCode = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const hashRecoveryCode = value => crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update('totp-recovery\0' + normalizeRecoveryCode(value)).digest('hex');
/** Ten one-time codes shown once ("abcde-fghij"); only their hashes are stored. */
function generateRecoveryCodes(count = 10) {
    const letters = 'abcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: count }, () => {
        const chars = Array.from(crypto.randomBytes(10), byte => letters[byte % letters.length]).join('');
        return chars.slice(0, 5) + '-' + chars.slice(5);
    });
}
function otpauthUri(secret, account) {
    return 'otpauth://totp/' + encodeURIComponent('CaltDHy:' + account) + '?secret=' + secret +
        '&issuer=CaltDHy&algorithm=SHA1&digits=6&period=30';
}

module.exports = { generateSecret, codeAt, currentStep, verifyCode, encryptSecret, decryptSecret,
    generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode, otpauthUri, base32Encode, base32Decode };
