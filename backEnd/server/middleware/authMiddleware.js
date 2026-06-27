const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware xác thực JWT – tối ưu hiệu năng
 *
 * Chiến lược:
 * 1. Verify signature + expiry của JWT (không cần DB).
 * 2. Kiểm tra passwordChangedAt để từ chối token cũ (nếu user vừa đổi/reset mật khẩu).
 *    Để tiết kiệm DB query, chỉ fetch user khi token không có trường `pca` (issued before
 *    the feature was added) HOẶC khi cần thiết theo yêu cầu business.
 *
 * Lưu ý: name/email được nhúng vào JWT payload nên không cần query DB mỗi request.
 */
const protect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Bạn chưa đăng nhập. Vui lòng đăng nhập để tiếp tục.'
            });
        }

        // Xác minh chữ ký + hạn token – không cần DB
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch user từ DB để kiểm tra passwordChangedAt — đảm bảo token cũ bị thu hồi sau khi đổi mật khẩu/email/tên
        // Chỉ lấy các trường cần thiết để giảm tải DB
        const user = await User.findById(decoded.id).select('+passwordChangedAt');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Tài khoản không tồn tại hoặc đã bị xóa.'
            });
        }

        // Kiểm tra token có được tạo TRƯỚC khi mật khẩu bị đổi không
        if (user.passwordChangedAt) {
            const tokenIssuedAt = decoded.iat * 1000; // iat là giây → đổi sang ms
            if (tokenIssuedAt < user.passwordChangedAt.getTime()) {
                return res.status(401).json({
                    success: false,
                    message: 'Mật khẩu vừa được thay đổi. Vui lòng đăng nhập lại.'
                });
            }
        }

        // Gắn user vào request (không kèm password)
        req.user = {
            id: user._id.toString(),
            name: user.name,
            email: user.email
        };

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.'
        });
    }
};

module.exports = { protect };
