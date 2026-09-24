# Kết quả sửa bảo mật CaltDHy

Bản tổng hợp ngày 22/09/2026. Đây là kết quả sửa mã nguồn và kiểm thử cục bộ; chưa triển khai hoặc kiểm thử hạ tầng production thật.

## Ba nhóm ưu tiên đã triển khai

| Nhóm | Thay đổi chính | Bằng chứng kiểm thử |
|---|---|---|
| 1 — Tránh mất dữ liệu và lộ bí mật | Cleanup/seed giới hạn môi trường, database và phạm vi tài khoản; migration có kiểm tra, dry-run và xác nhận. Log không chứa lỗi thô/token. Launcher di động, không cài dependency/build hoặc giết tiến trình theo cổng. Đóng gói theo allowlist và build bằng môi trường riêng. | Guard script trước kết nối; kiểm tra symlink/bí mật trong bundle; 21 tình huống supervisor và 3 ca shell launcher. |
| 2 — Toàn vẹn tiền tệ | Transaction bắt buộc, khóa ghi theo tài khoản, idempotency receipt, unique index theo kỳ, kiểm tra chủ sở hữu mọi liên kết. Số nguyên VND, BigInt khi cộng dồn; rollback khi số dư hoặc kết quả vượt giới hạn. Lịch sử hệ thống được bảo vệ khi xóa hũ/khoản định kỳ. | Replica set thật tạm thời: request đồng thời, ghi trùng, lỗi sau ghi, retry transaction, tất toán/xóa ví, bảo toàn tiền, BOLA, kỳ trả trùng, standalone bị từ chối. |
| 3 — Cách ly phiên và dữ liệu giao diện | Phiên opaque trong cookie HttpOnly, CSRF gắn với phiên, Secure cho HTTPS; xác minh phiên trước trang bảo vệ. Hủy request/đổi epoch/reset store khi đổi phiên, đồng bộ tab, bỏ thành công offline giả. Báo cáo vượt giới hạn hiển thị có thông báo và tổng chính xác. | Trình duyệt thật: đăng nhập/đăng xuất, phản hồi muộn, đổi tài khoản, hết hạn, offline, phản hồi sai định dạng, retry cùng khóa và bốn theme. |

## Kết quả cổng kiểm tra

`npm run test:all` đã chạy thành công trên máy cục bộ với Node 24, MongoDB 8.2.6 tạm và Chrome:

- 48 kiểm thử backend, không có ca bỏ qua hoặc thất bại.
- 5 kiểm thử số học frontend.
- 5 kiểm thử guard script/phát hành; một bộ launcher chứa 21 tình huống giả lập và 3 ca shell.
- 10 kịch bản trình duyệt; không có lỗi JavaScript chưa xử lý.
- Build frontend và quét allowlist nguồn phát hành thành công.

Lint frontend không có lỗi; còn 5 cảnh báo cũ về biến chưa dùng, export component và dependency của hook. Dependency đã được cập nhật theo lockfile; kiểm tra audit tại thời điểm sửa báo 0 lỗ hổng trong ba bộ dependency. Kết quả audit có thể thay đổi khi cơ sở dữ liệu advisory cập nhật.

CI có các job backend, browser và phát hành phụ thuộc nhau. Workflow đã được kiểm tra cấu trúc cục bộ; chưa được push và chưa có kết quả chạy trên GitHub. Không đánh đồng kiểm thử trên máy cục bộ với required checks đã bật trên repository.

## Phần cần thực hiện tại môi trường triển khai

1. Cấp MongoDB replica set và bí mật riêng. Nếu ZIP/.env cũ đã được chia sẻ ngoài phạm vi tin cậy, thay credential MongoDB/SMTP và khóa phiên, thu hồi giá trị cũ tại nhà cung cấp.
2. Sao lưu, thử khôi phục và đối soát dữ liệu cũ trước nâng cấp. Dữ liệu trùng chỉ mục, tiền thập phân, liên kết sai hoặc số dư không hợp lệ cần xử lý có kiểm soát; ứng dụng không tự sửa mất dấu vết.
3. Cấu hình HTTPS, cookie và reverse proxy theo [hướng dẫn vận hành](PRODUCTION-RUNBOOK.md); bật required checks trên GitHub sau khi workflow được đưa lên repository.

Giới hạn còn lại: rate limiting lưu theo tiến trình; cần store dùng chung trước triển khai nhiều instance. Kiểm tra bất biến đọc sổ giao dịch theo tài khoản nên cần kiểm thử tải với khối lượng thực. Khóa retry frontend chỉ tồn tại trong trang; sau lỗi mạng rồi tải lại trang, phải kiểm tra lịch sử trước khi tạo lại thao tác. Các chart vượt miền an toàn tạm bị ẩn thay vì hiển thị số bị làm tròn. Gửi mail thật, HTTPS, backup và quan sát vận hành chưa được kiểm tra trên production.

ZIP cuối là toàn bộ mã nguồn được phép phát hành, kèm manifest SHA-256. Gói không có `.env` thật, `node_modules` hoặc `dist`; người nhận cần chuẩn bị runtime theo runbook. Đây không phải app macOS độc lập đã ký/notarize.
