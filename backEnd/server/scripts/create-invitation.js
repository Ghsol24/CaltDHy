'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Invitation = require('../models/Invitation');
const { validEmail, normalizeEmail } = require('../utils/emailAddress');

async function main() {
    const email = process.argv[2];
    const days = process.argv[3] === undefined ? 7 : Number(process.argv[3]);
    if (!validEmail(email) || !Number.isSafeInteger(days) || days < 1 || days > 30) {
        throw new Error('Usage: node backEnd/server/scripts/create-invitation.js EMAIL [DAYS_1_TO_30]');
    }
    const uri = process.env.MONGODB_URI;
    const rawUrl = process.env.CLIENT_URL;
    if (typeof uri !== 'string' || !/^mongodb(?:\+srv)?:\/\//.test(uri) || !rawUrl) {
        throw new Error('MONGODB_URI and CLIENT_URL are required.');
    }
    const base = new URL(rawUrl);
    if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
        throw new Error('CLIENT_URL must be an HTTPS origin.');
    }
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    await Invitation.createCollection();
    await Invitation.createIndexes();
    const token = crypto.randomBytes(32).toString('hex');
    await Invitation.create({
        email: normalizeEmail(email),
        tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + days * 86400000)
    });
    const link = new URL('/signup', base);
    link.searchParams.set('invite', token);
    link.searchParams.set('email', normalizeEmail(email));
    process.stdout.write(link.toString() + '\n');
}

main().catch(error => {
    console.error('[invitation] ' + (error.message.startsWith('Usage:') ||
        error.message.startsWith('MONGODB_URI') || error.message.startsWith('CLIENT_URL')
        ? error.message : 'Unable to create invitation.'));
    process.exitCode = 1;
}).finally(async () => {
    await mongoose.disconnect().catch(() => {});
});
