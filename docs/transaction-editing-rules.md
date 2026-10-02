# Chỉnh sửa giao dịch và ngân sách theo tháng

- Không tự khóa giao dịch khi sang tháng. Tháng của giao dịch được xác định từ ngày giao dịch, độc lập với tháng đang xem trên trang tổng quan.
- Hộp giao dịch tải hạn mức của tháng được chọn trong trường ngày vào dữ liệu riêng; không ghi đè ngân sách đang xem. Trong lúc tải hoặc khi tải thất bại, không hiển thị hạn mức của tháng khác.
- Hạn mức trong hộp là dự kiến sau khi lưu: bỏ bản cũ khỏi phép tính rồi áp dụng bản đang sửa đúng một lần, gồm phí. Đổi ngày hoặc danh mục phải tính lại phân bổ tương ứng.
- Yêu cầu xác nhận khi thêm, sửa hoặc xóa làm thay đổi dữ liệu tài chính của tháng trước. Ghi chú đơn thuần không cần xác nhận. Xác nhận nêu các tháng bị ảnh hưởng và mức thay đổi số dư ví hiện tại.
- Nhật ký lưu trước/sau, người sửa và thời điểm cho sửa/xóa thành công. Giao dịch cũ không cần chuyển đổi dữ liệu: lần sửa đầu tiên sẽ ghi bản trước khi sửa. Không thể tạo lại lịch sử thay đổi trước khi tính năng được bật.
- Nhật ký được lưu cùng giao dịch cơ sở dữ liệu với thao tác tài chính, nên thao tác thất bại không để lại nhật ký thành công. Yêu cầu lặp lại cùng mã không tạo nhật ký trùng; lưu không đổi không tạo bản mới.
- `GET /api/spending/:id/history?page=1&limit=20` chỉ cho chủ dữ liệu truy cập, kể cả giao dịch đã xóa. Giới hạn tối đa 100 bản mỗi trang. Trong hộp sửa, mở **Lịch sử chỉnh sửa** để xem các bản trước/sau.
- Bản xuất dữ liệu bao gồm `transactionRevisions`. Đặt lại dữ liệu tài chính và dọn tài khoản phải xóa cả nhật ký chứa thông tin tài chính.
- Giao dịch do Hũ/Khoản định kỳ tạo tiếp tục được quản lý tại tính năng nguồn.

Danh sách ví nguồn và ví nhận trong hộp chuyển tiền được sắp xếp theo số dư hiện tại giảm dần. Số dư bằng nhau giữ thứ tự ban đầu; số dư thẻ tín dụng dùng giá trị có dấu, không dùng hạn mức tín dụng. Thứ tự không thay đổi ví mặc định hoặc danh sách ví tại các màn hình khác.

Kiểm tra hồi quy: kiểm thử logic tháng trong `frontEnd-react/tests/transaction-period.test.mjs`, nhật ký và tính nguyên tử trong `backEnd/server/tests/transaction-history.test.js`, và luồng trình duyệt trong `tests/transaction-period-browser.cjs` (cần bản build giao diện).
