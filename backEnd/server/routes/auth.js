const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');

// Helper: Tạo JWT token
const createToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
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

        // Hash mật khẩu
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Tạo user mới
        const newUser = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword
        });

        const token = createToken(newUser._id.toString());

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

        const token = createToken(user._id.toString());

        res.json({
            success: true,
            message: 'Đăng nhập thành công!',
            token,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email
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
                from: `"projectcanhan" <${process.env.GMAIL_USER}>`,
                to: email,
                subject: '🔑 Đặt lại mật khẩu – projectcanhan',
                html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f0f2f5; padding: 20px; border-radius: 8px;">
              <div style="background: #1877F2; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">📅 projectcanhan</h1>
              </div>
              <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
                <h2 style="color: #1c1e21;">Xin chào ${user.name},</h2>
                <p style="color: #606770; font-size: 15px;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
                <p style="color: #606770; font-size: 15px;">Nhấn vào nút bên dưới để đặt lại mật khẩu. Link này sẽ hết hạn sau <strong>15 phút</strong>.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetUrl}" style="background: #1877F2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">
                    Đặt lại mật khẩu
                  </a>
                </div>
                <p style="color: #606770; font-size: 13px;">Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
                <hr style="border: none; border-top: 1px solid #e4e6eb; margin: 20px 0;">
                <p style="color: #8a8d91; font-size: 12px; text-align: center;">© 2024 projectcanhan.com</p>
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
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiry = undefined;
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

module.exports = router;
