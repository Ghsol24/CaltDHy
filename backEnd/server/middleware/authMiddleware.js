const jwt = require('jsonwebtoken');
const { readData } = require('../utils/fileDB');

/**
 * Middleware xác thực JWT
 * Thay thế User.findById() của Mongoose bằng readData() + .find()
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

        // Tìm user trong data.json thay vì MongoDB
        const db = await readData();
        const user = db.users.find(u => u.id === decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Tài khoản không tồn tại.'
            });
        }

        // Gắn user vào request (không kèm password)
        req.user = {
            id: user.id,
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
