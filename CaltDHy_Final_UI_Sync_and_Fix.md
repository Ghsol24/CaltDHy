# Yêu Cầu Tổng Lực: Khôi Phục Nút Toggle & Đồng Bộ Theme - CaltDHy

**Bối cảnh:** Dự án đã được backup an toàn trên GitHub (Ghsol24/CaltDHy). Hiện tại đang gặp 2 lỗi nghiêm trọng về UI/UX.

**Nhiệm vụ 1: Khôi phục nút Theme Toggle trên index.html**
- Nút này hiện đang bị mất (chỉ còn nút Settings). Hãy chèn lại một nút Toggle (icon Mặt trời/Mặt trăng) ngay cạnh nút Settings.
- Style: 
  - Dark Mode: Industrial, bóng đổ chìm, cảm giác cơ khí.
  - Light Mode: Neumorphic, bóng đổ nổi, nền Off-white.

**Nhiệm vụ 2: Global Theme Sync (Đồng bộ toàn hệ thống)**
- Viết file `theme-manager.js` để nhúng vào TẤT CẢ các trang (`index.html`, `login.html`, `signup.html`, `reset-password.html`).
- Logic: 
  1. Khi Click nút Toggle: Đổi class `light-theme` trên thẻ `<html>` và lưu vào `localStorage.setItem('caltdhy_theme', 'light')`.
  2. Khi Load trang: Kiểm tra ngay `localStorage`, nếu là 'light' thì áp class `light-theme` ngay lập tức để tránh bị nháy màn hình trắng (FOUC).

**Nhiệm vụ 3: Redesign `reset-password.html`**
- Hiện tại trang này đang là HTML trắng thô, hãy viết lại CSS để nó đồng bộ 100% với Design System của CaltDHy (Dark/Light mode).
- Form đặt chính giữa, sử dụng Neumorphism card, nút "Đặt lại mật khẩu" phải có hiệu ứng phát sáng (glow) như nút Login ở trang chủ.

**Yêu cầu Code Style:**
- Trả về mã nguồn thuần (Raw code).
- TUYỆT ĐỐI KHÔNG sử dụng comment giải thích trong code (xóa sạch các dòng `//` hoặc `/* */`).
- Đảm bảo code chạy mượt trên Safari/Chrome của macOS.

## Implementation Details

### 1. theme-manager.js
```javascript
(function(){
  const THEME_KEY='caltdhy_theme';
  const html=document.documentElement;
  const applyTheme=theme=>{if(theme==='light'){html.classList.add('light-theme');html.classList.remove('dark-theme');}else{html.classList.add('dark-theme');html.classList.remove('light-theme');}}
  const stored=localStorage.getItem(THEME_KEY);
  if(stored){applyTheme(stored);}else{applyTheme('dark');}
  document.addEventListener('click',e=>{if(e.target.matches('.theme-toggle')){const newTheme=html.classList.contains('light-theme')?'dark':'light';applyTheme(newTheme);localStorage.setItem(THEME_KEY,newTheme);}});
})();
```

### 2. Add Toggle Button (HTML snippet)
```html
<button class="theme-toggle" aria-label="Toggle theme" style="background:none;border:none;cursor:pointer;">
  <svg class="icon sun" viewBox="0 0 24 24" width="24" height="24"><path d="M12 4.5V2m0 20v-2.5m7.07-12.57l1.77-1.77M4.16 19.84l1.77-1.77M20 12h2.5M1.5 12H4m15.07 5.07l1.77 1.77M4.16 4.16l1.77 1.77" stroke="currentColor" stroke-width="2" fill="none"/></svg>
  <svg class="icon moon" viewBox="0 0 24 24" width="24" height="24" style="display:none;"><path d="M21 12.79A9 9 0 0111.21 3c-.34 0-.68.02-1 .05a9 9 0 1010.79 9.74c-.02-.32-.04-.66-.05-1z" fill="currentColor"/></svg>
</button>
```

### 3. spending.css – Theme Variables & Card Style
```css
:root {
  --bg-dark:#0d0d0d;
  --bg-light:#f5f5f5;
  --primary:#ff6f00;
  --text-dark:#e0e0e0;
  --text-light:#202020;
}
html.dark-theme {background:var(--bg-dark);color:var(--text-dark);} 
html.light-theme {background:var(--bg-light);color:var(--text-light);} 

/* Neumorphic Card */
.neumo-card {
  background:var(--bg-light);
  border-radius:12px;
  box-shadow: 8px 8px 16px rgba(0,0,0,0.2), -8px -8px 16px rgba(255,255,255,0.1);
  padding:2rem;
  max-width:400px;
  margin:auto;
}
html.dark-theme .neumo-card {background:var(--bg-dark);box-shadow: 8px 8px 16px rgba(0,0,0,0.6), -8px -8px 16px rgba(255,255,255,0.05);}

/* Glow Button */
.glow-btn {
  background:var(--primary);
  border:none;
  color:#fff;
  padding:.75rem 1.5rem;
  border-radius:8px;
  box-shadow:0 0 12px var(--primary);
  transition:transform .2s,box-shadow .2s;
}
.glow-btn:hover{transform:scale(1.05);box-shadow:0 0 18px var(--primary);}
```

### 4. reset-password.html – Updated Structure
```html
<!DOCTYPE html>
<html lang="vi" class="dark-theme">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Đặt lại mật khẩu</title>
  <link rel="stylesheet" href="spending.css" />
  <script src="theme-manager.js" defer></script>
</head>
<body>
  <header class="flex justify-end p-4"><button class="theme-toggle"></button></header>
  <main class="flex items-center justify-center min-h-screen">
    <section class="neumo-card">
      <h2 class="text-center mb-4">Đặt lại mật khẩu</h2>
      <form>
        <input type="email" placeholder="Email" required class="w-full mb-3 p-2 rounded" />
        <button type="submit" class="glow-btn w-full">Đặt lại mật khẩu</button>
      </form>
    </section>
  </main>
</body>
</html>
```

### 5. Integration Steps
1. Place `theme-manager.js` in the project root.
2. Append the toggle button HTML next to the existing Settings button in `index.html`, `login.html`, `signup.html`, and `reset-password.html`.
3. Link `spending.css` and `theme-manager.js` in each HTML file’s `<head>`.
4. Ensure the `<html>` tag includes a default class `dark-theme`.
5. Test theme persistence across page reloads and navigation.
```