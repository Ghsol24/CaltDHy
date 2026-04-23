# Yêu Cầu Cập Nhật UI/UX và Đồng Bộ Theme Hệ Thống - CaltDHy

**Bối cảnh dự án:**
CaltDHy là hệ thống Expense Management hoạt động theo mô hình Local-first, sử dụng thuần HTML5, CSS3 và Vanilla JS. 
Hệ thống thiết kế đang áp dụng 2 chế độ:
- **Dark Mode ("Industrial Skeuomorphism"):** Nền tối `#1e2124`, giao diện cơ khí, viền dập nổi, nút bấm Neumorphic và đèn LED glow. Font chữ sử dụng Inter và JetBrains Mono.
- **Light Mode ("Minimalist Modern"):** Nền Off-white `#FAFAFA`, viền mỏng, đổ bóng mềm mại (Drop-shadow).
Trạng thái ứng dụng được lưu trữ qua `localStorage`.

**Vấn đề hiện tại:**
1. Trạng thái Theme (chế độ Sáng/Tối) không được giữ nguyên khi chuyển trang. Ví dụ: Người dùng đang ở `index.html` với nền tối, khi điều hướng sang `login.html` thì hệ thống lại bị reset về nền sáng.
2. Trang `reset-password.html` hiện tại đang là HTML thô (không có CSS), giao diện mặc định trắng bóc và hoàn toàn đứt gãy so với Design System của hệ thống.

**Nhiệm vụ yêu cầu:**

### Task 1: Đồng bộ trạng thái Theme (Global Theme Sync)
- Viết một đoạn script Vanilla JS (có thể tách thành `theme-manager.js` để nhúng vào tất cả các file HTML) làm nhiệm vụ quản lý Theme.
- Logic: Khi người dùng chọn giao diện (Sáng/Tối) ở bất kỳ đâu, lưu trạng thái đó vào `localStorage` (VD: `localStorage.setItem('caltdhy_theme', 'dark')`).
- Khi khởi tạo (load) bất kỳ trang nào (`index.html`, `login.html`, `reset-password.html`...), script phải tự động kiểm tra `localStorage` và thêm class/thuộc tính tương ứng vào thẻ `<body>` hoặc `<html>` ngay lập tức để đồng bộ màu nền, tránh hiện tượng FOUC (Flash of Unstyled Content).

### Task 2: Redesign toàn diện `reset-password.html`
- Viết lại cấu trúc HTML và CSS cho trang `reset-password.html` để đồng bộ 100% với giao diện hiện tại của `index.html`.
- **Yêu cầu UI:**
  - Bố cục: Form đặt ở trung tâm màn hình (sử dụng Flexbox hoặc Grid).
  - Background: Tuân theo biến màu của Theme Sync ở Task 1 (Mặc định là Dark Mode `#1e2124`).
  - Container (Card): Áp dụng hiệu ứng Neumorphism, bo góc, có bóng đổ dập nổi.
  - Typography: Dùng font Inter cho text thường và JetBrains Mono cho các placeholder/nhãn dán mang tính kỹ thuật.
  - Input field (Mật khẩu mới, Xác nhận mật khẩu): Thiết kế dạng input cơ học, viền tối, chữ sáng, có focus state rõ ràng.
  - Button "Đặt lại mật khẩu": Sử dụng style tương tự như nút "Log In" màu đỏ có hiệu ứng phát sáng (glow) như trên trang chủ.

**Đầu ra mong muốn:**
- Cung cấp mã JS cho `theme-manager.js`.
- Cung cấp code hoàn chỉnh (HTML + CSS) cho trang `reset-password.html` đã được redesign. Cố gắng giữ "raw code" và hạn chế comment giải thích không cần thiết.