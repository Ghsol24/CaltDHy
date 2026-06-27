const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Budget = require('../models/Budget');
const { protect } = require('../middleware/authMiddleware');

// ─────────────────────────────────────────────────────────────────
// Helper: Tạo JWT token
// Nhúng name + email vào payload để middleware không cần query DB
// Nhúng pca (passwordChangedAt timestamp) để detect token bị thu hồi
// ─────────────────────────────────────────────────────────────────
const createToken = (user) => {
    const payload = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        // pca = passwordChangedAt (ms). Dùng để invalidate token sau khi đổi mật khẩu.
        pca: user.passwordChangedAt ? user.passwordChangedAt.getTime() : 0
    };
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
};

// Helper: Cấu hình Nodemailer với Gmail
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS
        }
    });
};

// Giới hạn kích thước avatar: 1MB cho Base64 string (≈ 1.37MB raw → ~1MB ảnh)
// Base64 overhead ≈ 33%, nên 1MB ảnh ≈ 1.37MB string
const MAX_AVATAR_BYTES = 1.5 * 1024 * 1024; // 1.5MB string limit

// =============================================
// POST /api/auth/register – Đăng ký tài khoản
// =============================================
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });
        }

        // Kiểm tra email đã tồn tại chưa
        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email này đã được đăng ký. Vui lòng dùng email khác.'
            });
        }

        // Hash mật khẩu – truyền rounds trực tiếp (gọn hơn genSalt riêng)
        const hashedPassword = await bcrypt.hash(password, 12);

        // Tạo user mới
        const newUser = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword
        });

        // Tạo một số danh mục ngân sách mặc định để tránh người dùng mới bị ngợp
        await Budget.insertMany([
            { userId: newUser._id, category: 'Food & Dining', limit: 3000000 },
            { userId: newUser._id, category: 'Transport', limit: 1000000 },
            { userId: newUser._id, category: 'Utilities', limit: 1500000 },
            { userId: newUser._id, category: 'Entertainment', limit: 800000 }
        ]);

        const token = createToken(newUser);

        res.status(201).json({
            success: true,
            message: 'Đăng ký thành công!',
            token,
            user: {
                id: newUser._id.toString(),
                name: newUser.name,
                email: newUser.email
            }
        });
    } catch (error) {
        console.error('POST /register error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server. Vui lòng thử lại.' });
    }
});

// =============================================
// POST /api/auth/login – Đăng nhập
// =============================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập email và mật khẩu.'
            });
        }

        // Phải select password vì schema ẩn nó trong toJSON
        const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Email hoặc mật khẩu không đúng.'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Email hoặc mật khẩu không đúng.'
            });
        }

        const token = createToken(user);

        res.json({
            success: true,
            message: 'Đăng nhập thành công!',
            token,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('POST /login error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server. Vui lòng thử lại.' });
    }
});

// =============================================
// POST /api/auth/forgot-password – Quên mật khẩu
// =============================================
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email: email?.toLowerCase().trim() }).select('+resetPasswordToken +resetPasswordExpiry');

        if (!user) {
            // Không tiết lộ email có tồn tại hay không (bảo mật)
            return res.json({
                success: true,
                message: 'Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.'
            });
        }

        // Tạo reset token ngẫu nhiên
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
        await user.save();

        const resetUrl = `${process.env.CLIENT_URL}/reset-password.html?token=${resetToken}&email=${email}`;

        console.log(`\n🔑 [RESET PASSWORD] Link đặt lại mật khẩu cho ${email}:\n   ${resetUrl}\n`);

        // Gửi email
        try {
            const transporter = createTransporter();
            const mailOptions = {
                from: `"CaltDHy" <${process.env.GMAIL_USER}>`,
                to: email,
                subject: '🔑 Đặt lại mật khẩu – CaltDHy',
                html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f0f2f5; padding: 20px; border-radius: 8px;">
              <div style="background: #FF4B72; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">📅 CaltDHy</h1>
              </div>
              <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
                <h2 style="color: #1c1e21;">Xin chào ${user.name},</h2>
                <p style="color: #606770; font-size: 15px;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
                <p style="color: #606770; font-size: 15px;">Nhấn vào nút bên dưới để đặt lại mật khẩu. Link này sẽ hết hạn sau <strong>15 phút</strong>.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetUrl}" style="background: #FF4B72; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">
                    Đặt lại mật khẩu
                  </a>
                </div>
                <p style="color: #606770; font-size: 13px;">Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
                <hr style="border: none; border-top: 1px solid #e4e6eb; margin: 20px 0;">
                <p style="color: #8a8d91; font-size: 12px; text-align: center;">© 2024 CaltDHy</p>
              </div>
            </div>
          `
            };

            await transporter.sendMail(mailOptions);
            res.json({
                success: true,
                message: 'Đã gửi email hướng dẫn đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.'
            });
        } catch (emailErr) {
            console.error('⚠️ Lỗi gửi email thực tế:', emailErr.message);
            res.json({
                success: true,
                message: 'Đã tạo yêu cầu đặt lại mật khẩu. Vui lòng kiểm tra terminal/console để lấy link đặt lại mật khẩu (hoặc hộp thư của bạn).'
            });
        }
    } catch (error) {
        console.error('POST /forgot-password error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server. Vui lòng thử lại.' });
    }
});

// =============================================
// POST /api/auth/reset-password – Đặt lại mật khẩu
// =============================================
router.post('/reset-password', async (req, res) => {
    try {
        const { token, email, newPassword } = req.body;

        if (!token || !email || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Thông tin không đầy đủ.'
            });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu mới phải có ít nhất 6 ký tự.'
            });
        }

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            email: email.toLowerCase().trim(),
            resetPasswordToken: hashedToken,
            resetPasswordExpiry: { $gt: new Date() } // Token còn hạn
        }).select('+password +resetPasswordToken +resetPasswordExpiry');

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'
            });
        }

        // Hash mật khẩu mới
        user.password = await bcrypt.hash(newPassword, 12);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiry = undefined;
        // Ghi lại thời điểm đổi mật khẩu → vô hiệu hóa các JWT cũ
        user.passwordChangedAt = new Date();
        await user.save();

        res.json({
            success: true,
            message: 'Mật khẩu đã được đặt lại thành công! Vui lòng đăng nhập lại.'
        });
    } catch (error) {
        console.error('POST /reset-password error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server. Vui lòng thử lại.' });
    }
});

// =============================================
// PUT /api/auth/profile – Cập nhật tài khoản
// =============================================
router.put('/profile', protect, async (req, res) => {
    try {
        const { name, email, avatar, currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        // Tìm user trong database
        const user = await User.findById(userId).select('+password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
        }

        // 1. Validate và cập nhật mật khẩu (nếu có yêu cầu)
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng nhập mật khẩu hiện tại để đặt mật khẩu mới.'
                });
            }
            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Mật khẩu mới phải có ít nhất 6 ký tự.'
                });
            }
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    message: 'Mật khẩu hiện tại không chính xác.'
                });
            }
            // Hash mật khẩu mới
            user.password = await bcrypt.hash(newPassword, 12);
            // Ghi lại thời điểm đổi mật khẩu → vô hiệu hóa các JWT cũ
            user.passwordChangedAt = new Date();
        }

        // 2. Cập nhật email (nếu có yêu cầu thay đổi)
        if (email && email.toLowerCase().trim() !== user.email) {
            const trimmedEmail = email.toLowerCase().trim();
            if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
                return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });
            }
            // Kiểm tra email đã có người sử dụng chưa
            const emailExists = await User.findOne({ email: trimmedEmail });
            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Email này đã được sử dụng bởi tài khoản khác.'
                });
            }
            user.email = trimmedEmail;
            // ⚠️ Bảo mật: đổi email ⇒ vô hiệu hóa toàn bộ JWT token cũ được cấp trước đó
            user.passwordChangedAt = new Date();
        }

        // 3. Cập nhật tên hiển thị
        if (name && name.trim() && name.trim() !== user.name) {
            user.name = name.trim();
            // ⚠️ Bảo mật: đổi tên ⇒ vô hiệu hóa toàn bộ JWT token cũ (tên được nhúng trong payload token)
            user.passwordChangedAt = new Date();
        }

        // 4. Validate và cập nhật ảnh đại diện (Base64 string)
        if (avatar !== undefined) {
            // Server-side: kiểm tra kích thước avatar (tối đa ~1.5MB string)
            if (avatar && Buffer.byteLength(avatar, 'utf8') > MAX_AVATAR_BYTES) {
                return res.status(400).json({
                    success: false,
                    message: 'Kích thước ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 1MB.'
                });
            }
            user.avatar = avatar;
        }

        // Lưu thông tin cập nhật
        await user.save();

        // Tạo token mới (bao gồm thông tin mới + pca mới)
        const token = createToken(user);

        res.json({
            success: true,
            message: 'Cập nhật tài khoản thành công!',
            token,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('PUT /profile error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server. Vui lòng thử lại.' });
    }
});

module.exports = router;
