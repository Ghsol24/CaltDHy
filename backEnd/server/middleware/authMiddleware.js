const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware xác thực JWT
 * Dùng User.findById() của Mongoose thay cho readData() + .find()
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

        // Xác minh token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Tìm user trong MongoDB – không select password (select: false ở schema)
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Tài khoản không tồn tại.'
            });
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
