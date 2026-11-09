# Chỉnh sửa giao dịch và ngân sách theo tháng

- Không tự khóa giao dịch khi sang tháng. Tháng của giao dịch được xác định từ ngày giao dịch, độc lập với tháng đang xem trên trang tổng quan.
- Hộp giao dịch tải hạn mức của tháng được chọn trong trường ngày vào dữ liệu riêng; không ghi đè ngân sách đang xem. Trong lúc tải hoặc khi tải thất bại, không hiển thị hạn mức của tháng khác.
- Hạn mức trong hộp là dự kiến sau khi lưu: bỏ bản cũ khỏi phép tính rồi áp dụng bản đang sửa đúng một lần, gồm phí. Đổi ngày hoặc danh mục phải tính lại phân bổ tương ứng.
- Yêu cầu xác nhận khi thêm, sửa hoặc xóa làm thay đổi dữ liệu tài chính của tháng trước. Ghi chú đơn thuần không cần xác nhận. Xác nhận nêu các tháng bị ảnh hưởng và mức thay đổi số dư ví hiện tại.
- Nhật ký lưu trước/sau, người sửa và thời điểm cho sửa/xóa thành công. Giao dịch cũ không cần chuyển đổi dữ liệu: lần sửa đầu tiên sẽ ghi bản trước khi sửa. Không thể tạo lại lịch sử thay đổi trước khi tính năng được bật.
- Nhật ký được lưu cùng giao dịch cơ sở dữ liệu với thao tác tài chính, nên thao tác thất bại không để lại nhật ký thành công. Yêu cầu lặp lại cùng mã không tạo nhật ký trùng; lưu không đổi không tạo bản mới.
- `GET /api/spending/:id/history?page=1&limit=20` chỉ cho chủ dữ liệu truy cập, kể cả giao dịch đã xóa. Giới hạn tối đa 100 bản mỗi trang. Hộp sửa tải trang đầu khi mở: giao dịch chưa từng thay đổi không hiện gì; giao dịch đã thay đổi hiện một dòng **"Đã sửa N lần · Xem lịch sử"**, bấm để xem các bản trước/sau.
- Bàn phím ảo không bao giờ tự bật: trên thiết bị cảm ứng (`pointer: coarse`), cả hộp **thêm** lẫn hộp **sửa** đều không tự đặt con trỏ vào ô nhập; người dùng chạm vào ô nào thì mới nhập ô đó. Trên máy tính (không có bàn phím ảo), hộp thêm vẫn đặt con trỏ sẵn ở ô Số tiền; hộp sửa thì không.
- Nút **Xóa** nằm trong hộp sửa giao dịch, nên dùng được ở Trang chủ, Lịch sử và Phân tích; mọi nơi dùng chung `useDeleteTransaction` (xác nhận, xóa, thông báo **Hoàn tác**).
- Hoàn tác gọi `POST /api/spending/:id/restore`: dựng lại giao dịch từ bản chụp của lần xóa gần nhất, **giữ nguyên ID** để lịch sử chỉnh sửa cũ vẫn gắn liền, và ghi một mục `restore` (không có `before`). Ngày cũ được giữ, kể cả tháng trước. Từ chối khi giao dịch vẫn còn, ví đã đóng hoặc không còn, giao dịch thuộc Hũ/Khoản định kỳ, hoặc khôi phục làm số dư không hợp lệ.
- Bản xuất dữ liệu bao gồm `transactionRevisions`. Đặt lại dữ liệu tài chính và dọn tài khoản phải xóa cả nhật ký chứa thông tin tài chính.
- Giao dịch do Hũ/Khoản định kỳ tạo tiếp tục được quản lý tại tính năng nguồn.

## Trang Ngân sách: chuyển tháng

- Hạn mức được nhớ theo từng tháng trong phiên (`budgetsByMonth`, đăng xuất là xóa). Tháng liền trước và liền sau được tải trước khi một tháng hiện xong; rê chuột hoặc focus vào nút ‹ › tải trước thêm hai tháng theo hướng đó. Tháng đã nhớ quá 60 giây được làm mới ở nền; danh sách danh mục chỉ tải lại sau 60 giây.
- Chuyển tháng là đổi trọn gói: thẻ tổng quan và bảng chỉ hiển thị chi tiêu và hạn mức của **cùng một tháng** đã tải xong. Trong lúc tải, ô chọn tháng đổi chữ ngay và hiện vòng xoay sau 150ms, nội dung giữ nguyên tháng cũ. Khung xương chỉ dùng khi chưa có tháng nào để hiện. Kết quả trả về muộn chỉ ghi vào bộ nhớ, không thay tháng đang xem.
- Tháng không có hạn mức riêng **kế thừa** tháng gần nhất trước nó (phía server). Vì vậy lưu hạn mức tháng M phải xóa khỏi bộ nhớ mọi tháng sau M; các tháng trước M không đổi. Một lượt đọc bắt đầu trước khi lưu không được ghi đè kết quả vừa lưu.
- Mọi tháng dùng chung một khung để chiều cao không đổi: nhãn (nhịp chi / "Vượt X%" / "Dư X%" / "Chưa bắt đầu"), dòng mốc (Hôm nay / Kết thúc kỳ / Bắt đầu), dòng kết quả tháng trước, và đúng hai chỉ số. Nhãn chỉ số luôn một dòng. "Chi ngoài hạn mức" là tổng của nhóm "Chưa đặt hạn mức" trong bảng. Tháng đã đóng ghi "Kết quả" (Dư/Vượt), không gắn nhãn "quá hạn" cho từng dòng.
- Chuyển cảnh: mờ dần và dịch 12px theo hướng chuyển trong 160ms, tắt khi bật giảm chuyển động. Máy tính: phím ←/→ khi focus ở thanh chọn tháng. Điện thoại: vuốt ngang trên nội dung (từ 56px, ngang gấp đôi dọc, trong 700ms, không tính khi bắt đầu cách mép màn hình dưới 24px).
- Kiểm tra hồi quy: `frontEnd-react/tests/budget-month.test.mjs` và `tests/budget-month-browser.cjs` (đo từng khung hình trên máy tính và điện thoại, mạng nhanh và chậm).

Danh sách ví nguồn và ví nhận trong hộp chuyển tiền được sắp xếp theo số dư hiện tại giảm dần. Số dư bằng nhau giữ thứ tự ban đầu; số dư thẻ tín dụng dùng giá trị có dấu, không dùng hạn mức tín dụng. Thứ tự không thay đổi ví mặc định hoặc danh sách ví tại các màn hình khác.

Kiểm tra hồi quy: kiểm thử logic tháng trong `frontEnd-react/tests/transaction-period.test.mjs`, nhật ký và tính nguyên tử trong `backEnd/server/tests/transaction-history.test.js`, và luồng trình duyệt trong `tests/transaction-period-browser.cjs` (cần bản build giao diện).
