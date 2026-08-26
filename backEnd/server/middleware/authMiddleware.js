const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware xác thực JWT – Tối ưu hiệu năng và bảo mật
 *
 * Chiến lược:
 * 1. Verify chữ ký số và hạn dùng của token JWT (stateless check).
 * 2. Sử dụng truy vấn .lean() chỉ lấy các trường cần thiết ('name email +passwordChangedAt')
 *    để kiểm tra xem tài khoản còn tồn tại không và token có bị thu hồi do đổi mật khẩu không.
 *    Việc dùng .lean() giúp loại bỏ hoàn toàn chi phí hydrate Mongoose Document, giảm đáng kể RAM/CPU.
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

        // Xác minh chữ ký + hạn token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Truy vấn nhẹ nhàng (lean) để kiểm tra tồn tại và thu hồi token nếu đổi mật khẩu
        const user = await User.findById(decoded.id).select('name email +passwordChangedAt').lean();

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Tài khoản không tồn tại hoặc đã bị xóa.'
            });
        }

        // Kiểm tra token có được tạo TRƯỚC khi mật khẩu bị thay đổi không
        if (user.passwordChangedAt) {
            const tokenIssuedAt = decoded.iat * 1000; // iat là giây → đổi sang ms
            const pwdChangedTime = new Date(user.passwordChangedAt).getTime();
            if (tokenIssuedAt < pwdChangedTime) {
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
