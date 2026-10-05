# Thiết kế lại Xu hướng dòng tiền — 05/10/2026

Thiết kế đã được người dùng duyệt trước khi triển khai. Phạm vi là giao diện và thiết lập của Xu hướng dòng tiền; dữ liệu giao dịch và cách tính số dư không thay đổi.

## Công việc

1. Thêm thiết lập theo tài khoản: nhớ lựa chọn trực tiếp gần nhất; cho phép lưu và bỏ cách xem mặc định. Lưu loại dữ liệu, kỳ 1/3/6 tháng và bộ lọc định kỳ, không lưu ngày/tháng lịch cụ thể. Xem sâu bằng cột biểu đồ không ghi đè thiết lập.
2. Thay ba nút kỳ và nút định kỳ thường trực bằng hai dropdown. Bổ sung kính lúp chọn ngày trong khu vực biểu đồ; hỗ trợ bàn phím, đóng bằng Escape và trả lại tiêu điểm.
3. Cho xem Chi tiêu, Thu nhập hoặc Thu và chi. Trục cột bắt đầu ở 0 và tự điều chỉnh theo dữ liệu đang vẽ. Tổng thu/chi/chênh lệch cùng phạm vi kỳ và bộ lọc định kỳ; thông báo rõ phạm vi so với báo cáo tổng.
4. Giữ bảng xếp hạng ba ngày chi nhiều, mở thêm tối đa năm ngày. Khi đủ chiều rộng nội dung, xếp bên phải; khi thiếu chỗ, chuyển xuống dưới, có tính cả sidebar. Điện thoại giữ khoảng bảy ngày và ghi rõ bảng xếp hạng lấy trên cả kỳ.
5. Phân biệt ngày chưa tới, đánh dấu tháng hiện tại đang diễn ra. Chạm tháng mở xem các ngày và có thao tác quay lại kỳ trước.

## Kiểm tra

- Kiểm tra lưu/khôi phục/mặc định, dữ liệu không hợp lệ, đổi tài khoản và lỗi khi lưu.
- Kiểm tra bộ lọc thu/chi, phí giao dịch, định kỳ, ranh giới năm và tháng nhuận.
- Kiểm tra thực tế trong trình duyệt: điều khiển, chọn ngày, mở chi tiết, quay lại kỳ, tải lại và bố cục.
- Kiểm tra các theme light, dark, cream, green cùng chiều rộng điện thoại, tablet, laptop nhỏ và màn hình rộng; menu và nội dung không bị che hoặc tràn ngang.
- Chạy bộ kiểm tra và build phù hợp của dự án. Lưu ảnh bằng dữ liệu giả lập để đối chiếu thiết kế.

## Kết quả triển khai

Đã hoàn tất giao diện, dữ liệu biểu đồ và lưu thiết lập theo tài khoản.

- Hai dropdown quản lý kỳ 1/3/6 tháng và Chi tiêu/Thu nhập/Thu và chi. Bộ lọc định kỳ và thao tác đặt/bỏ mặc định nằm trong dropdown Hiển thị. Kính lúp Xem ngày nằm trong khu vực biểu đồ.
- Tài khoản chưa có lựa chọn bắt đầu với Chi tiêu theo ngày. Các lựa chọn trực tiếp được nhớ tự động; mặc định đã ghim được ưu tiên khi mở lại. Ghim cách xem khi đang xem sâu một tháng lưu riêng mặc định, giữ nguyên lựa chọn gần nhất và thao tác quay lại.
- Biểu đồ chỉ vẽ chuỗi được chọn, trục bắt đầu ở 0 và tự điều chỉnh. Dữ liệu kiểm thử với lương 7 triệu cho thang thu–chi tới 8 triệu, còn chế độ Chi tiêu dùng thang 500 nghìn. Tổng thu/chi/chênh lệch, xếp hạng ngày và chi tiết giao dịch dùng cùng kỳ và bộ lọc định kỳ.
- Danh sách ngày chi nhiều hiện ba dòng, mở thêm tối đa năm. Hai cột chỉ xuất hiện khi nội dung bên trong card rộng ít nhất 920px; vùng hẹp hơn xếp danh sách dưới biểu đồ. Điện thoại giữ bảy ngày trên biểu đồ và ghi rõ xếp hạng lấy trên toàn kỳ.
- Tháng hiện tại có nhãn Đang diễn ra; các ngày chưa tới được tô vùng riêng. Một tuần hoàn toàn chưa tới có thông báo riêng khi chưa có dữ liệu. Chọn cột tháng mở các ngày của tháng đó và cho quay lại đúng kỳ trước.
- Menu hỗ trợ bàn phím, Escape và khôi phục tiêu điểm; điện thoại dùng bảng trượt có khóa cuộn nền. Điều khiển chính có vùng bấm tối thiểu 44px. Các nhãn mới có tiếng Việt, Anh và Trung.

## Nghiệm thu

| Kiểm tra | Kết quả |
| --- | --- |
| Frontend: dữ liệu, bộ lọc, thiết lập, đổi tài khoản và lỗi lưu | 50 kiểm tra qua |
| Backend: tài khoản, thiết lập, bảo mật và các quy tắc tài chính | 91 kiểm tra qua |
| Trình duyệt: Xu hướng dòng tiền | 8 kịch bản qua |
| Trình duyệt: các luồng ứng dụng và bảo mật hiện có | 24 kịch bản qua |
| Trình duyệt: giao dịch theo kỳ, lịch sử chỉnh sửa và bố cục | 15 kịch bản qua |
| Light, dark, cream, green × 320/390/768/1024/1280/1440px | 24 tổ hợp qua; menu trong màn hình, không tràn ngang |
| Tương phản các nhãn và số tiền chính, vùng bấm | Tối thiểu 4,5:1 cho chữ nhỏ và 44px cho điều khiển chính trên màn hình cảm ứng |
| Bản dựng production, giới hạn dung lượng tải đầu, kiểm tra nguồn phát hành | Qua |
| Lint và khoảng trắng bản diff | Không có lỗi; giữ nguyên ba cảnh báo lint có sẵn ngoài phạm vi thay đổi |

Kiểm tra trình duyệt chạy trên Chrome với chiều rộng giả lập và dữ liệu giả trong cơ sở dữ liệu tạm. Ảnh nghiệm thu dùng dữ liệu này. Chưa kiểm tra trên thiết bị điện thoại vật lý hoặc Safari. Các thay đổi hiện nằm trong workspace, chưa đưa lên máy chủ.

Có thể chạy lại kiểm tra riêng bằng `npm run test:cash-flow` sau khi dựng frontend. Bộ kiểm tra tự tạo tài khoản, cơ sở dữ liệu và máy chủ cục bộ, rồi dọn chúng khi kết thúc; ảnh đầy đủ được lưu vào thư mục tạm `caltdhy-cash-flow-evidence` (có thể đổi bằng `CASH_FLOW_QA_DIR`). Kịch bản này cũng được nối vào `npm run test:e2e`.
