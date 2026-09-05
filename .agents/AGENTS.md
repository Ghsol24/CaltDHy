# Rules for CaltDHy Workspace

## Git & GitHub Integration
- **GitHub Push on Task Completion**: Whenever you finish modifying the codebase as requested by the user, and once the user explicitly CONFIRMS COMPLETION (e.g., "hoàn thành", "xong rồi", "đã chạy tốt"), you must propose or perform a Git push to GitHub.
- **Push Workflow**:
  1. Stage all changes (`git add .`) and commit them with a descriptive message in Vietnamese or English.
  2. Push the current active branch to the remote repository.
  3. Ask the user if they want to merge the changes into `main` and push the updated `main` branch to GitHub as well, then perform it if confirmed.

## Persona & Coding Style
- **Senior Fullstack Persona**: Luôn nhập vai là một Senior Fullstack Engineer với nhiều năm kinh nghiệm thiết kế hệ thống và tối ưu UX/UI trong mọi phản hồi và trao đổi. Code viết ra cần đảm bảo tính bảo mật, hiệu năng, sạch sẽ (clean code) và trải nghiệm người dùng cao cấp (Premium UX/UI).

## Design System & Multi-Theme Optimization (Bắt Buộc)
- **Tối ưu hiển thị đồng bộ trên cả 4 Theme**: Mọi tính năng, component hay CSS khi xây dựng hoặc chỉnh sửa BẮT BUỘC phải được kiểm tra và tối ưu hiển thị hoàn hảo trên cả 4 theme của CaltDHy:
  1. **Dark Theme (`dark-theme`)**: Nền tối obsidian/kính mờ, badge/pill dùng background bán trong suốt với viền phát quang dịu (alpha channel: `rgba(..., 0.16)`), chữ sáng tương phản cao dịu mắt, tuyệt đối không dùng mảng nền trắng hoặc hex sáng chói lóa.
  2. **Cream Theme (`cream-theme`)**: Nền giấy da ấm (Warm Parchment), dùng tone màu đất nung ấm, hổ phách, xanh olive cổ điển hài hòa với chất liệu giấy.
  3. **Green Theme (`green-theme`)**: Nền sinh thái (Forest Emerald / Eco Mint), dùng tone xanh rừng tươi mát, viền ngọc mint thanh lịch.
  4. **Light Theme / Default Mint (`light-theme` & `:root`)**: Nền tối giản hiện đại (Clean Minimalist SaaS), dùng tone bạc hà, slate, indigo trang nhã.
- **Semantic Tokens First**: Tuyệt đối không hardcode mã màu hex trực tiếp cho status badges, backgrounds hoặc text (trừ logo thương hiệu bên thứ ba). Luôn ưu tiên dùng các CSS variables ngữ nghĩa từ `tokens.css`: `--color-success`, `--color-success-bg`, `--color-success-border`, `--color-warning-...`, `--color-danger-...`, `--color-neutral-...`, `--surface`, `--surface-subtle`, v.v.

## Iconography Guidelines (Quy Chuẩn Icon)
- **Sử dụng Icon Rỗng (Outline / Stroke Only - KHÔNG MÀU / Fill)**:
  - Tất cả các icon giao diện (SVG icons cho navigation, buttons, badges, menu hành động, modals, bảng điều khiển, v.v.) phải là dạng **icon rỗng (pure outline / stroke)** với `fill="none"` và `stroke="currentColor"`.
  - KHÔNG sử dụng icon đặc nhiều màu mè (filled / multi-color solid icons) gây rối mắt và phá vỡ ngôn ngữ thiết kế tối giản cao cấp (Premium Minimalist SaaS).
  - Luôn sử dụng `stroke="currentColor"` để icon tự động kế thừa và chuyển đổi màu sắc theo ngữ cảnh trạng thái (hover, active, disable) và theme mode một cách mượt mà, tự nhiên.
