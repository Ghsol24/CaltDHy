/**
 * Helper validate số tiền VNĐ.
 *
 * VNĐ không có đơn vị nhỏ hơn 1 đồng (không có phần thập phân), nhưng trước đây
 * mọi field amount/limit/current/target chỉ được validate bằng Number.isFinite(...),
 * cho phép lọt qua các giá trị như 1000.5. Không gây lỗi ngay, nhưng tích lũy qua
 * nhiều phép $inc (nạp/rút hũ, cộng dồn balance...) có rủi ro sai số dấu phẩy động
 * về lâu dài. Dùng hàm này ở MỌI nơi nhận số tiền từ người dùng thay vì tự viết lại
 * điều kiện Number.isFinite(...) rải rác — để không lặp lại kiểu lệch chuẩn từng
 * xảy ra với category (mỗi chỗ tự validate một kiểu, dần dà lệch nhau).
 */

/**
 * @param {*} value Giá trị cần kiểm tra (thường là req.body.amount/limit/target/current).
 * @param {{ allowZero?: boolean }} [options] allowZero=true cho phép giá trị 0 (mặc định chỉ cho phép > 0).
 * @returns {boolean} true nếu là số nguyên hữu hạn hợp lệ theo điều kiện trên.
 */
function isValidVNDAmount(value, { allowZero = false } = {}) {
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return false;
    return allowZero ? n >= 0 : n > 0;
}

/**
 * Kiểm tra là số nguyên hữu hạn, KHÔNG ràng buộc dấu — dùng cho các field được phép âm
 * (vd initialBalance của ví tín dụng có thể âm khi mới tạo ví đã có nợ sẵn).
 * @param {*} value
 * @returns {boolean}
 */
function isFiniteInteger(value) {
    const n = Number(value);
    return Number.isFinite(n) && Number.isInteger(n);
}

module.exports = { isValidVNDAmount, isFiniteInteger };
