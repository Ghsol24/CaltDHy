'use strict';
// Tỷ giá tham chiếu cho phần hiển thị USD. Công khai, không gắn với tài khoản nào.
const express = require('express');
const router = express.Router();
const { getUsdRate, toPublic } = require('../utils/exchangeRate');

router.get('/usd', async (req, res, next) => {
    try {
        const snapshot = await getUsdRate();
        if (!snapshot) {
            return res.status(503).json({
                success: false,
                code: 'FX_UNAVAILABLE',
                message: 'Chưa có tỷ giá tham chiếu. Vui lòng thử lại sau.'
            });
        }
        return res.json({ success: true, ...toPublic(snapshot) });
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
