/**
 * One-time migration: backfills emailVerified: true for all legacy users
 * who registered before the email verification feature cutoff (2026-08-23).
 *
 * Security Guarantee:
 * - Scoped strictly to legacy users created BEFORE the cutoff date (createdAt < 2026-08-23).
 * - Never affects new users created after this cutoff date who are pending email verification.
 * - Idempotent and safe to run without bypassing security for future users.
 *
 * Usage:
 *   From backEnd/server: node scripts/migrate-email-verified.js
 *   From root: npm run migrate:email
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');

// Mốc thời gian kích hoạt tính năng email verification (23/08/2026)
const VERIFICATION_FEATURE_CUTOFF = new Date('2026-08-23T00:00:00.000Z');

async function migrateEmailVerified() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error('Thiếu MONGODB_URI trong file .env. Không thể kết nối database.');
    }

    console.log('🔄 Đang kết nối tới MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối cơ sở dữ liệu.');

    // Chỉ lọc các tài khoản legacy được tạo trước mốc cutoff
    const filter = {
        createdAt: { $lt: VERIFICATION_FEATURE_CUTOFF },
        $or: [
            { emailVerified: false },
            { emailVerified: { $exists: false } },
            { emailVerified: null }
        ]
    };

    const targetUsersCount = await User.countDocuments(filter);

    if (targetUsersCount === 0) {
        console.log(`✨ Tất cả user legacy (trước ${VERIFICATION_FEATURE_CUTOFF.toISOString().slice(0, 10)}) đã có emailVerified: true. Không cần cập nhật.`);
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

    console.log(`🎉 Hoàn thành migration! Đã cập nhật ${result.modifiedCount} tài khoản legacy thành emailVerified: true.`);
}

// Chạy trực tiếp từ CLI — không tự chạy nếu file này bị require() từ nơi khác.
if (require.main === module) {
    migrateEmailVerified()
        .catch((error) => {
            console.error('❌ Migration thất bại:', error.message);
            process.exitCode = 1;
        })
        .finally(async () => {
            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
                console.log('🔌 Đã ngắt kết nối database.');
            }
        });
}

module.exports = { migrateEmailVerified };
