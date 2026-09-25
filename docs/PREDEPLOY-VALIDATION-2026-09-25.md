# Kiểm tra trước khi phát hành — 25/09/2026

Phạm vi là mã đang sửa trong workspace, trên bản build production chạy cục bộ. Chưa commit, đẩy GitHub hoặc triển khai lên `caltdhy.onrender.com`. Các lần khảo sát giao diện dùng dữ liệu API giả lập, không chạm dữ liệu tài chính thật.

## Lỗi tìm thấy và đã sửa

1. **Màu trạng thái chưa đủ tương phản ở một số theme.** Màu cảnh báo và nguy hiểm dùng làm chữ có trường hợp dưới 4,5:1 trên bề mặt sáng/xanh; nhãn cảnh báo/nguy hiểm ở theme tối còn kế thừa màu chữ dành cho nền sáng. Đã chỉnh token ngữ nghĩa trong `tokens.css` và thêm kiểm tra màu chữ, bề mặt phụ, nền nhãn sau khi tính lớp trong suốt cho cả bốn theme. Các trường hợp được kiểm tra hiện đạt tối thiểu 4,5:1.
2. **Chân modal bị che khi chiều cao khung nhìn giảm.** Khi mô phỏng bàn phím ảo bằng cách giảm chiều cao từ 844 xuống 430px, nút hành động của modal giao dịch và tạo Hũ từng nằm dưới mép màn hình. Đã để chiều cao tối đa của thẻ modal phụ thuộc vùng backdrop đang hiển thị. Kiểm tra lại tại 320px và 390px cho thấy nút ở trong khung nhìn, còn phần nội dung có thể cuộn.

Trong quá trình bổ sung kiểm tra màu, phép đo thử nghiệm chưa xử lý được mã hex rút gọn `#fff`; đã sửa bộ đo. Đây là lỗi của kiểm tra, không phải lỗi giao diện.

## Kết quả kiểm tra

| Nhóm | Kết quả |
| --- | --- |
| Kiểm tra mã nguồn/frontend | 29 đạt |
| Backend và bất biến tài chính trên MongoDB replica set cục bộ | 59 đạt |
| Trình duyệt production build: xác thực, phiên, giao dịch lỗi/idempotency, PWA, theme và giao diện mobile | 18 tình huống đạt; không có lỗi JavaScript không xử lý |
| Build, ngân sách dung lượng UX, kiểm tra nguồn phát hành | Đạt |
| Lint | Đạt; còn 3 cảnh báo đã có từ trước, không phát hiện lỗi mới |
| Ma trận giao diện | 64 trường hợp: 4 theme × 4 kích thước × 4 màn (đăng nhập, Home, Hũ, phân tích); không tràn ngang hay lỗi JavaScript. Thêm 12 trạng thái dialog ở 320px. |
| Hỗ trợ bàn phím/trình đọc màn hình | 101 điều khiển ở các màn khảo sát đều có tên truy cập; modal có tên; 20 lần Tab cho mỗi modal giao dịch, Settings và Hũ không thoát khỏi modal. |
| PWA/chuyển động | Service worker đăng ký, trang đăng nhập tải lại khi offline; màu thanh trình duyệt theo theme; chế độ giảm chuyển động được áp dụng. |

## Giới hạn nghiệm thu

Ma trận giao diện và kiểm tra truy cập trên đây chạy trong Chrome tự động với API giả lập. Máy hiện không có iOS Simulator, Android Emulator hoặc kết nối thiết bị thật, nên chưa xác nhận bàn phím ảo thật, VoiceOver/TalkBack, mức zoom trình duyệt thực 200%, hay màn khởi động của PWA đã cài trên iOS/Android. Dữ liệu giả lập cũng chưa thay thế thử nghiệm với lịch sử tài chính thật có nội dung dài và biểu đồ dày đặc. Những phần này cần nghiệm thu trên thiết bị và dữ liệu phù hợp trước khi coi toàn bộ ma trận trong [kế hoạch giao diện tối](DARK-THEME-REVIEW-PLAN.md) là hoàn tất.

**Bổ sung sau phản hồi từ điện thoại:** bộ kiểm tra ở trên chưa phát hiện trường hợp thanh điều hướng đáy che phần cuối trang, tab con đè nút và biểu đồ ngày dày đặc. Các trường hợp đó được tái hiện, sửa và kiểm tra lại trong [báo cáo UX di động](MOBILE-UX-REMEDIATION-2026-09-25.md). Kết quả ban đầu không thay thế vòng nghiệm thu mới này.
