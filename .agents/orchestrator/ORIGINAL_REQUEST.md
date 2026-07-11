# Original User Request

## 2026-07-11T06:33:39Z

Làm sạch giao diện UI/UX của ứng dụng quản lý chi tiêu CaltDHy theo chuẩn premium, đồng thời bổ sung biểu đồ báo cáo chi tiết về xu hướng chi tiêu hàng ngày.

Working directory: /Users/ghtude10./Documents/10.gh/proJectLinhTinh/CaltDHy
Integrity mode: development

## Requirements

### R1. Làm sạch & Nâng cấp Giao diện UI/UX Premium (Tự đánh giá & Nâng cấp)
- Tự động đánh giá giao diện hiện tại của ứng dụng CaltDHy (`spending.html`, `spending.js`, và các file CSS liên quan).
- Làm sạch và tối ưu hóa các phần chưa mượt mà (căn chỉnh khoảng cách padding/margin, tăng tính nhất quán của font chữ và màu sắc).
- Đảm bảo giữ nguyên phong cách retro/console chassis-frame đặc trưng (bao gồm khung máy cơ khí, vít liên kết) nhưng làm mịn hơn, nâng cao độ phân giải thị giác và thẩm mỹ của hệ thống.
- Cải tiến trải nghiệm tương tác thông qua hiệu ứng hover nhẹ nhàng, transitions mượt mà, và trạng thái loading trực quan.

### R2. Bổ sung Biểu đồ Xu hướng Chi tiêu theo Ngày (Daily Spending Trend)
- Tích hợp biểu đồ xu hướng chi tiêu theo các ngày trong tháng (Daily Spending Trend Chart) bằng thư viện `Chart.js` đã được liên kết sẵn trong dự án.
- Biểu đồ này cần hiển thị dưới dạng cột (Bar) hoặc đường (Line), tự động hiển thị số tiền đã chi tiêu (expense) theo từng ngày trong tháng được chọn.
- Đặt canvas biểu đồ này trong thẻ div `view-analytics` cạnh hoặc thay thế vị trí phù hợp trong phần hiển thị thống kê.
- Biểu đồ phải tự động cập nhật ngay lập tức khi thêm/xóa giao dịch hoặc thay đổi bộ lọc tháng.
