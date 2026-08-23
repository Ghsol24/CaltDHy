/**
 * One-time migration: backfills emailVerified: true for all legacy users
 * who registered before the email verification feature was enabled.
 *
 * This prevents existing users from being locked out with 403 Forbidden.
 * Safe to re-run (idempotent): only updates users where emailVerified is false or undefined.
 *
 * Usage:
 *   From backEnd/server: node scripts/migrate-email-verified.js
 *   From root: npm run migrate:email
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function migrateEmailVerified() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error('Thiếu MONGODB_URI trong file .env. Không thể kết nối database.');
    }

    console.log('🔄 Đang kết nối tới MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối cơ sở dữ liệu.');

    // Tìm tất cả user có emailVerified !== true (bao gồm false, null, undefined)
    const filter = {
        $or: [
            { emailVerified: false },
            { emailVerified: { $exists: false } },
            { emailVerified: null }
        ]
    };

    const targetUsersCount = await User.countDocuments(filter);

    if (targetUsersCount === 0) {
        console.log('✨ Tất cả user đã có emailVerified: true. Không cần cập nhật.');
        return;
    }

    console.log(`📦 Tìm thấy ${targetUsersCount} tài khoản legacy cần cập nhật emailVerified: true...`);

    const result = await User.updateMany(
        filter,
        {
            $set: {
                emailVerified: true
            },
            $unset: {
                emailVerificationToken: "",
                emailVerificationExpiry: ""
            }
        }
    );

    console.log(`🎉 Hoàn thành migration! Đã cập nhật ${result.modifiedCount} tài khoản thành emailVerified: true.`);
}

migrateEmailVerified()
    .catch((error) => {
        console.error('❌ Migration thất bại:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
        console.log('🔌 Đã ngắt kết nối database.');
    });
