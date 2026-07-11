# Báo Cáo Phân Tích UI/UX & Đề Xuất Tối Ưu Hóa Tương Tác Cận Cao Cấp (Premium UX/UI)

*Người thực hiện: Explorer 3 — Senior Fullstack Engineer*
*Dự án: CaltDHy Expense Manager*
*Mục tiêu: Đánh giá logic tương tác, chuyển động (transitions) và hành vi của các thành phần giao diện trong `frontEnd/spending.html` và `frontEnd/spending.js`, đồng thời đề xuất cải tiến mã nguồn và kiểu dáng (CSS) để đạt chuẩn Premium UX/UI.*

---

## I. TỔNG QUAN ĐÁNH GIÁ (CONSENSUS FINDINGS)
Hệ thống giao diện của CaltDHy được thiết kế theo phong cách giao diện kỹ thuật số/bảng điều khiển (dark-panel/industrial OS style) rất đặc trưng và có độ hoàn thiện cao. Hệ thống tokens, custom dropdowns và focus trap được tích hợp kỹ lưỡng. Tuy nhiên, qua phân tích sâu luồng tương tác và chuyển động, chúng tôi phát hiện **10 điểm hạn chế lớn về mặt chuyển cảnh, FOUC (visual jump), khóa cuộn nền, và sự bất đồng bộ giữa CSS và JS**. Những điểm này làm giảm trải nghiệm mượt mà, bóng bẩy của một sản phẩm "Premium".

---

## II. CHI TIẾT CÁC PHÁT HIỆN & ĐỀ XUẤT TỐI ƯU HÓA (DETAILED FINDINGS & PROPOSALS)

### 1. Lỗi Hiệu Ứng Xuất Hiện Modal (Broken Modal Entry Animations)
* **Phát hiện:** Trong `modals.css`, hiệu ứng `animation: modalIn .28s ...` được gắn trực tiếp trên các selector `.modal-card`, `.numpad-device`, và `guideSlideIn` trên `.guide-panel`. Vì các phần tử này luôn tồn tại trong cấu trúc HTML DOM (chỉ ẩn/hiện bằng cách toggle class `.open` trên overlay cha), hiệu ứng hoạt họa này sẽ tự động kích hoạt **ngay khi trang web vừa tải** (khi mà modal vẫn đang bị ẩn hoàn toàn). Khi người dùng nhấn nút mở modal, lớp `.open` được thêm vào lớp cha, nhưng hiệu ứng hoạt họa của modal card không hề chạy lại. Người dùng chỉ thấy phần nền mờ (backdrop) hiện lên mượt mà còn thẻ modal card thì hiển thị tĩnh ngay lập tức.
* **Đề xuất sửa đổi (CSS):** Di chuyển thuộc tính `animation` vào selector scoped khi lớp cha có trạng thái hoạt động:
  ```css
  /* Thay vì: .modal-card { animation: modalIn ... } */
  .modal-card {
    /* Các thuộc tính tĩnh giữ nguyên, không để animation ở đây */
  }
  .modal-overlay.open .modal-card {
    animation: modalIn .28s cubic-bezier(.34, 1.2, .64, 1) both;
  }
  .modal-overlay--numpad.open .numpad-device {
    animation: modalIn .22s cubic-bezier(.34, 1.2, .64, 1) both;
  }
  .guide-overlay.open .guide-panel {
    animation: guideSlideIn var(--dur-slow) cubic-bezier(.22, 1, .36, 1) both;
  }
  .modal-overlay.open .form-group {
    animation: fadeUp var(--dur-mid) ease both;
  }
  ```

---

### 2. Thiếu Hiệu Ứng Biến Mất Của Modal (No Symmetric Exit Transitions)
* **Phát hiện:** Khi tắt modal (xóa bỏ class `.open`), lớp overlay mờ nền có quá trình mờ dần thông qua `transition: opacity var(--dur-mid)`. Tuy nhiên, vì thẻ `.modal-card` sử dụng `@keyframes modalIn` chỉ chạy một chiều khi mở, nên khi đóng, thẻ modal card chỉ mờ dần tuyến tính theo opacity của cha mà không có hiệu ứng thu nhỏ (scale down) hay trượt xuống (slide out) tương ứng.
* **Đề xuất sửa đổi (CSS Transitions thay cho Keyframes):** Chuyển đổi cơ chế hoạt họa của modal card từ `@keyframes` sang CSS Transitions lồng ghép với class `.open` để có cả hiệu ứng mở/đóng đối xứng hoàn hảo:
  ```css
  .modal-card {
    transform: scale(.96) translateY(10px);
    opacity: 0;
    transition: transform .28s cubic-bezier(.34, 1.2, .64, 1), opacity .28s ease;
  }
  .modal-overlay.open .modal-card {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
  ```

---

### 3. Rò Rỉ Cuộn Nền (Background Scroll Leaking)
* **Phát hiện:** Trong `spending.js`, chỉ có 6 trên tổng số 13 hàm mở modal thực hiện khóa cuộn nền bằng `document.body.style.overflow = 'hidden'`. Các modal lớn khác như modal thêm giao dịch chính (`openModal`), Cài đặt (`openSettings`), Tài khoản (`openAccountModal`), Ngân sách (`openBudgetModal`), và Quick Log (`openQuickLog`) không hề khóa cuộn nền. Người dùng vẫn có thể dùng chuột/touchpad cuộn trang nội dung chính bên dưới trong khi modal đang mở, gây cảm giác lỏng lẻo về bố cục UI.
* **Đề xuất sửa đổi (CSS Modern):** Loại bỏ toàn bộ các dòng gán JS rườm rà. Sử dụng bộ chọn `:has()` hiện đại trong CSS để tự động khóa cuộn cơ thể bất cứ khi nào có bất kỳ modal nào hoạt động:
  ```css
  body:has(.modal-overlay.open),
  body:has(.guide-overlay.open) {
    overflow: hidden !important;
  }
  ```

---

### 4. Layout Shift & FOUC Khi Tải Trạng Thái Sidebar (Nav Rail Collapse Jump)
* **Phát hiện:** Logic đọc cấu hình ẩn/hiện thanh sidebar trái (`railCollapsed`) được thực thi trong hàm `DOMContentLoaded` ở cuối file `spending.js`. Điều này khiến trình duyệt render bố cục sidebar mở rộng đầy đủ (`280px`) trước, sau đó khi JS chạy xong mới thêm class `.rail-collapsed` làm thu hẹp đột ngột, gây ra hiện tượng giật giật màn hình (layout shift) gây khó chịu cho người dùng.
* **Đề xuất sửa đổi (Inline Head/Body Script):** Thêm một đoạn mã kịch bản nhỏ cực nhanh ngay đầu thẻ `<body>` hoặc ngay dưới thẻ mở của container chứa rail để xử lý class trước lần vẽ đầu tiên (anti-FOUC):
  ```html
  <div class="app-body">
    <script>
      if (localStorage.getItem('railCollapsed') === 'true') {
        document.currentScript.parentElement.classList.add('rail-collapsed');
      }
    </script>
    <aside class="rail" ...>
  ```

---

### 5. Co Giật Giao Diện Thanh Rail Khi Thu/Phóng (Sidebar Transition Warping)
* **Phát hiện:** Thuộc tính `overflow: hidden !important` chỉ được gán cho rail khi ở trạng thái đã đóng (`.app-body.rail-collapsed .rail`). Tuy nhiên, khi người dùng bấm mở lại sidebar, class `.rail-collapsed` bị gỡ ngay lập tức. Trong suốt `0.35s` hiệu ứng chiều rộng chạy từ `0px` lên `280px`, rail không hề có `overflow: hidden` khiến các chữ và thẻ card bên trong bị bóp méo, tự động xuống dòng và méo mó bố cục tạm thời trước khi đạt kích thước chuẩn. Hơn nữa, rail khi collapsed vẫn giữ `padding-top` và `padding-bottom` ở mức `28px` làm hộp bố cục vẫn chiếm không gian ảo.
* **Đề xuất sửa đổi (CSS):**
  1. Đưa `overflow-x: hidden` làm thuộc tính mặc định của lớp `.rail` để bảo vệ nội dung không bị vỡ trong suốt quá trình chuyển động co/giãn.
  2. Sửa thuộc tính khi collapsed thành `padding: 0 !important` để triệt tiêu hoàn toàn khoảng đệm dọc.
  ```css
  .rail {
    /* ... giữ nguyên ... */
    overflow-x: hidden; /* Đảm bảo an toàn khi co/giãn */
  }
  .app-body.rail-collapsed .rail {
    width: 0px !important;
    padding: 0px !important; /* Thay vì chỉ padding-left/right */
    border-right-width: 0px !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
  ```

---

### 6. Dropdown Chọn Tháng Biến Mất Đột Ngột (Month Picker Instant Close)
* **Phát hiện:** Dropdown chọn tháng `.month-picker-dropdown` bật tắt bằng thuộc tính `display: none` và `display: block`. Mặc dù lúc mở dropdown có chạy hoạt họa thông qua `@keyframes popupFadeIn`, nhưng khi đóng, class `.open` bị gỡ bỏ làm dropdown lập tức chuyển về `display: none` và biến mất đột ngột không hề có hiệu ứng thu nhỏ hay mờ dần.
* **Đề xuất sửa đổi (CSS Transitions):** Sử dụng cơ chế tương tự custom dropdown: ẩn/hiện bằng `opacity`, `transform` và `pointer-events: none` để kích hoạt hiệu ứng chuyển cảnh mượt mà hai chiều:
  ```css
  .month-picker-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 290px;
    background: rgba(30, 33, 36, 0.96);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: var(--r-md);
    padding: 12px;
    box-shadow: var(--sh-float);
    
    /* Chuyển động mượt mà 2 chiều */
    opacity: 0;
    transform: translateY(-4px);
    pointer-events: none;
    transition: opacity 180ms ease, transform 180ms cubic-bezier(.16, 1, .3, 1);
  }
  .month-picker-dropdown.open {
    display: block; /* Đổi display: none thành luôn hiển thị dạng inline/block và kiểm soát qua opacity */
  }
  /* Cải tiến chuẩn: Loại bỏ display hoàn toàn trong CSS động, kiểm soát bằng class */
  .month-picker-dropdown {
    display: block !important; /* Luôn để block nhưng tàng hình */
  }
  .month-picker-dropdown.open {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
  ```

---

### 7. Thành Phần CSS "Zombie" Cho Trạng Thái Trống (Unused Enhanced Empty States)
* **Phát hiện:** Trong `components.css` có chứa định nghĩa thành phần UI trống rất đẹp mắt `.empty-state` (gồm icon, title, description, và nút hành động CTA). Thế nhưng trong file `spending.js`, các trạng thái trống của danh sách giao dịch (`txnFeed`), hũ tiết kiệm (`jarsGrid`) và khoản định kỳ (`installmentList`) lại đang sử dụng những chuỗi HTML thô sơ `.txn-empty`, `.jars-empty-state` và `.inst-empty` (riêng `.inst-empty` còn không được định nghĩa style trong CSS, gây hiển thị thô lệch lạc).
* **Đề xuất sửa đổi (JS Upgrade):** Nâng cấp logic render chuỗi trống trong `spending.js` để tận dụng tối đa thành phần `.empty-state` cao cấp sẵn có trong CSS:
  * **Đối với Transaction Feed:**
    ```javascript
    if (list.length === 0) {
      feed.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">💸</div>
          <h3 class="empty-state__title">${t('noTxn')}</h3>
          <p class="empty-state__hint">${t('pressAdd')}</p>
          <button class="empty-state__cta" onclick="openModal()">${t('addTransaction')}</button>
        </div>`;
      return;
    }
    ```
  * **Đối với Jars Grid:**
    ```javascript
    if (jars.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🫙</div>
          <h3 class="empty-state__title">Hũ Tiết Kiệm</h3>
          <p class="empty-state__hint">Chưa có hũ nào. Bắt đầu phân tích và tích lũy các quỹ của bạn ngay.</p>
          <button class="empty-state__cta" onclick="openAddJarModal()">Tạo Hũ Mới</button>
        </div>`;
      return;
    }
    ```
  * **Đối với Installment List:**
    ```javascript
    if (installments.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">💳</div>
          <h3 class="empty-state__title">Hóa Đơn Định Kỳ</h3>
          <p class="empty-state__hint">Chưa có khoản chi tiêu định kỳ nào. Thêm lịch thanh toán để quản lý dòng tiền.</p>
          <button class="empty-state__cta" onclick="openAddInstallmentModal()">Thêm Khoản</button>
        </div>`;
      return;
    }
    ```

---

### 8. Thiếu Trạng Thái Tải Dữ Liệu Trực Quan (Lack of Skeleton Loaders)
* **Phát hiện:** Khi ứng dụng khởi động và thực hiện đồng bộ trực tuyến qua `syncLoadFromServer()`, dữ liệu được tải không đồng bộ từ API. Trong khoảng thời gian chờ đợi (mạng chậm, server phản hồi trễ), giao diện các danh sách hoàn toàn trống trơn không có bất kỳ chỉ báo đang tải nào, tạo cảm giác hệ thống bị đơ (frozen) hoặc không hoạt động.
* **Đề xuất cải tiến (Skeleton CSS & JS Loader):**
  1. Thêm định nghĩa Skeleton Shimmer CSS trong `components.css`:
     ```css
     .skeleton {
       background: linear-gradient(90deg, var(--recessed) 25%, var(--surface2) 50%, var(--recessed) 75%);
       background-size: 200% 100%;
       animation: shimmer 1.5s infinite linear;
     }
     @keyframes shimmer {
       0% { background-position: -200% 0; }
       100% { background-position: 200% 0; }
     }
     ```
  2. Trong `spending.js`, hiển thị trạng thái skeleton trước khi fetch hoàn thành:
     ```javascript
     function showLoadingSkeletons() {
       const feed = document.getElementById('txnFeed');
       if (feed) {
         feed.innerHTML = Array(3).fill().map(() => `
           <div class="txn-slot" style="pointer-events:none;">
             <div class="txn-icon skeleton" style="border-radius:50%; width:32px; height:32px;"></div>
             <div class="txn-info" style="flex:1;">
               <div class="skeleton" style="width: 50%; height: 12px; margin-bottom: 6px; border-radius:4px;"></div>
               <div class="skeleton" style="width: 30%; height: 8px; border-radius:3px;"></div>
             </div>
             <div class="skeleton" style="width: 60px; height: 14px; border-radius:4px;"></div>
           </div>
         `).join('');
       }
     }
     ```
     Gọi `showLoadingSkeletons()` ngay đầu hàm `syncLoadFromServer()`.

---

### 9. Chuyển Đổi Theme Đột Ngột Gây Nhức Mắt (Harsh Theme Flash)
* **Phát hiện:** Khi chuyển đổi giao diện qua `pickTheme()` / `setTheme()`, các biến màu sắc CSS của theme mới được áp dụng ngay lập tức lên thẻ `<html>`. Việc này gây ra một cú giật màu sắc đột ngột và chói mắt.
* **Đề xuất cải tiến (CSS Transitions Chỉ Kích Hoạt Khi Switch):** Sử dụng kỹ thuật áp dụng transition tạm thời. Chỉ bật thuộc tính transition trong thời điểm thực hiện đổi theme để tránh giảm hiệu năng lúc cuộn trang thông thường:
  1. Thêm CSS transition tạm thời:
     ```css
     .theme-transitioning,
     .theme-transitioning * {
       transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease, box-shadow 0.3s ease !important;
     }
     ```
  2. Bổ sung mã điều khiển trong `theme-manager.js`:
     ```javascript
     function _apply(theme) {
       var root = document.documentElement;
       root.classList.add('theme-transitioning');
       
       ALL_CLASSES.forEach(function (c) { root.classList.remove(c); });
       if (theme && theme !== 'dark') {
         root.classList.add(theme + '-theme');
       }
       _syncButtons(theme || 'dark');
       
       // Gỡ bỏ lớp transition sau khi hoàn tất chuyển màu sắc
       setTimeout(function() {
         root.classList.remove('theme-transitioning');
       }, 300);
     }
     ```

---

### 10. Hiện Đại Hóa Hướng Dẫn/Mẹo Tooltips Bằng Trình Duyệt Gốc (Modern Popover & Anchor Positioning)
* **Phát hiện:** Tooltip hướng dẫn sao lưu (`backupTooltip`) sử dụng logic JS bắt sự kiện click bên ngoài để đóng mở và định vị tuyệt đối thủ công.
* **Đề xuất cải tiến (Modern Web API):** Sử dụng các tính năng web hiện đại như **HTML Popover API** kết hợp với **CSS Anchor Positioning**. Phương pháp này giúp loại bỏ hoàn toàn mã JS quản lý đóng/mở, tự động xử lý đóng bằng phím ESC và nhấp chuột bên ngoài một cách đồng bộ và tối ưu nhất:
  * **HTML sửa đổi:**
    ```html
    <button class="info-btn" popovertarget="backupTooltip" aria-label="Hướng dẫn sao lưu">?</button>
    <div id="backupTooltip" popover class="info-tooltip">
      <p class="info-tooltip__title">💾 Sao Lưu &amp; Khôi Phục</p>
      <p class="info-tooltip__body">...</p>
    </div>
    ```
  * **CSS sửa đổi:**
    ```css
    .info-tooltip {
      position-anchor: --backupBtn;
      position: absolute;
      bottom: anchor(top);
      left: anchor(left);
      margin: 0;
      /* Các thuộc tính style khác giữ nguyên */
    }
    ```

---

## III. KẾT LUẬN & ĐỀ XUẤT HÀNH ĐỘNG
Các phân tích trên chỉ ra rằng CaltDHy đã có một nền tảng thiết kế UI rất vững chắc. Việc thực hiện các điều chỉnh về **chuyển cảnh đối xứng (symmetric transitions)**, **khóa cuộn thông minh**, và **áp dụng đúng các lớp Empty State / Skeleton** sẽ nâng cấp tương tác của trang web lên một vị thế vượt trội về mặt thẩm mỹ lẫn tính chuyên nghiệp.

Đề xuất bàn giao báo cáo này cho **Implementer** để tiến hành chỉnh sửa các đoạn mã CSS tương ứng trong `frontEnd/css/components.css`, `frontEnd/css/modals.css` và logic chuyển đổi trong `frontEnd/spending.js`.
