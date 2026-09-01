/**
 * Helpers để lấy "hôm nay" theo giờ Việt Nam (UTC+7, không có DST) một cách an
 * toàn, tránh bug lệch ngày do dùng trực tiếp `new Date()` làm giá trị field
 * `date` của Transaction.
 *
 * Gốc rễ bug: Transaction.js#toJSON gọi `date.toISOString().slice(0, 10)` để
 * trả `date` dạng 'YYYY-MM-DD' — hàm này LUÔN quy đổi sang UTC. Nếu field
 * `date` được set bằng `new Date()` (thời điểm server tạo bản ghi) thay vì
 * neo theo ngày dương lịch Việt Nam, thì bất kỳ giao dịch nào được tạo trong
 * khung 00:00–06:59 giờ VN (khi đó UTC vẫn còn là ngày/tháng hôm trước) sẽ bị
 * lưu lùi lại một ngày — và nếu rơi đúng ngày 1 đầu tháng, giao dịch bị tính
 * nhầm sang tháng trước, ảnh hưởng ngân sách & thống kê tháng.
 *
 * `spending.js#parseTransactionDate` đã tránh đúng bug này cho input do client
 * gửi lên (neo tại UTC midnight của chuỗi ngày). Hai hàm dưới đây áp dụng cùng
 * nguyên tắc cho các chỗ SERVER tự sinh `date` (nạp/rút hũ, thanh toán định kỳ...).
 *
 * Xem thêm: docs/financial-transaction-rules.md
 */

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Trả về chuỗi 'YYYY-MM-DD' của "hôm nay" theo giờ Việt Nam.
 * @returns {string}
 */
function getVietnamTodayString() {
    // Locale 'en-CA' format sẵn theo dạng YYYY-MM-DD, khỏi phải tự ghép chuỗi.
    return new Date().toLocaleDateString('en-CA', { timeZone: VN_TIMEZONE });
}

/**
 * Trả về một Date object neo tại 00:00:00 UTC của ngày hôm nay theo giờ Việt
 * Nam — dùng làm giá trị field `date` khi tạo Transaction. Nhờ neo tại UTC
 * midnight của đúng ngày dương lịch VN, khi Transaction.toJSON() gọi lại
 * `.toISOString().slice(0, 10)` (luôn UTC), kết quả vẫn khớp đúng ngày hôm nay
 * theo giờ Việt Nam trong MỌI khung giờ trong ngày.
 * @returns {Date}
 */
function nowAsVietnamDateAnchor() {
    return new Date(`${getVietnamTodayString()}T00:00:00.000Z`);
}

module.exports = { getVietnamTodayString, nowAsVietnamDateAnchor };
