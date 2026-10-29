# Kế hoạch sửa lỗi UX/UI nhỏ — 29/10/2026

Phạm vi: 5 vấn đề người dùng báo qua 13 ảnh chụp màn hình (PC + điện thoại).
Trạng thái: **đã thực hiện cả 5 mục** (xem mục "Đã chốt và kết quả" cuối file).

> Ghi chú về số ảnh: mục "Cần chú ý" nói "giống ảnh 5", nhưng ảnh 5 là lịch chọn ngày của
> modal *Tạo hũ tiết kiệm*. Bản mẫu thanh cảnh báo (badge "Vượt nhiều / Vượt trung bình /
> Cần theo dõi") là **ảnh 6**. Kế hoạch này hiểu là ảnh 6.

---

## 1. Lịch chọn ngày chưa theo UI dự án (ảnh 1–4 → giống ảnh 5)

### Nguyên nhân
Dự án đã có lịch tự vẽ theo theme, `CustomDatePicker`
([components/ui/CustomDatePicker.jsx](../frontEnd-react/src/components/ui/CustomDatePicker.jsx)),
được thêm ở commit `a9d478d`. Hiện chỉ 2 nơi dùng nó: modal Tạo hũ (ảnh 5) và khoảng ngày
tự chọn trong Lịch sử. Các chỗ còn lại vẫn dùng `<input type="date">` / `type="month"` gốc
của trình duyệt. Popup gốc của trình duyệt **không thể đổi theme** (nền xám, nút ↑↓ kiểu
macOS, ngày chọn màu xanh dương hệ thống), nên lệch hẳn so với phần còn lại của app.

| Ảnh | Màn hình | Vị trí code | Loại |
|---|---|---|---|
| 1, 2 | Thêm giao dịch (Chi tiêu / Thu nhập) | [TransactionModal.jsx:608](../frontEnd-react/src/features/transactions/TransactionModal.jsx#L608) | `date` |
| 3 | Thêm khoản định kỳ — *Ngày đến hạn tiếp theo* | [RecurringModal.jsx:711](../frontEnd-react/src/features/plan/RecurringModal.jsx#L711) | `date` |
| — | Thêm khoản định kỳ — *Ngày kết thúc* (khi bật "Có kỳ hạn") | [RecurringModal.jsx:750](../frontEnd-react/src/features/plan/RecurringModal.jsx#L750) | `date` |
| — | Chuyển tiền giữa ví — *Ngày chuyển* (cùng lỗi, chưa chụp) | [TransferModal.jsx:349](../frontEnd-react/src/features/plan/TransferModal.jsx#L349) | `date` |
| 4 | Xu hướng dòng tiền → Kỳ xem → chọn tháng | [CashFlowPanel.jsx:98](../frontEnd-react/src/features/analytics/CashFlowPanel.jsx#L98) | `month` |
| — | Xu hướng dòng tiền → Xem ngày | [CashFlowPanel.jsx:148](../frontEnd-react/src/features/analytics/CashFlowPanel.jsx#L148) | `date` |

Thêm một lý do nữa: Firefox không hỗ trợ `type="month"` (hiện thành ô text trơn).

### Cách sửa
1. **Tách lõi lịch ra khỏi popover.** Trong `CustomDatePicker.jsx`, tách phần lưới ngày
   (header tháng, hàng thứ, lưới ngày, footer *Xoá / Hôm nay*) thành `CalendarPanel`.
   `CustomDatePicker` = ô nhập + nút lịch + popover bọc `CalendarPanel` (giữ nguyên hành vi
   hiện tại). Như vậy panel có thể dùng *inline* ở nơi đã nằm sẵn trong một popover.
2. **Thêm `MonthPanel` / `CustomMonthPicker`** cùng style `calt-date-*`: header `‹ 2026 ›`,
   lưới 3×4 tháng (T1…T12), tô tháng đang chọn, viền tháng hiện tại, khoá tháng vượt `max`,
   footer *Tháng này*. Giá trị vẫn là chuỗi `YYYY-MM` nên `onMonthChange` không phải đổi.
   Hàm thuần (parse/format/clamp tháng) đặt trong `utils/datePicker.js` để test được.
3. **Thêm prop `required`** cho `CustomDatePicker`: khi người dùng xoá trắng ô nhập thì trả
   về ngày hợp lệ gần nhất thay vì gọi `onChange('')`, và ẩn nút *Xoá* (`clearable={false}`).
   Cần vì cả 3 form đều `noValidate`, nên thuộc tính `required` gốc vốn không có tác dụng.
4. **Thay từng chỗ:**
   - TransactionModal, TransferModal, RecurringModal (2 ô): dùng `CustomDatePicker` với
     `inputClassName` theo class ô nhập đang có (`txn-input`, `modal-pro-input`). Bỏ icon
     lịch ở đầu ô (`modal-input-icon-wrap`, `modal-date-input-wrap`) vì component đã có nút
     lịch bên phải như ảnh 5. Ô *Ngày kết thúc* giữ `min={nextDueDate}`.
   - CashFlowPanel: popover *Kỳ xem* dùng `MonthPanel` **inline** (không lồng popover trong
     popover, tránh bị cắt bởi `overflow` của popover cha); popover *Xem ngày* dùng
     `CalendarPanel` inline với `min/max = dateMin/dateMax`.
   - [CashFlowPopover.jsx:89](../frontEnd-react/src/features/analytics/CashFlowPopover.jsx#L89)
     đang focus `input[type="date"]` → đổi sang focus ô ngày/tháng đang chọn.
5. **Kiểm tra trong modal:** popover của lịch là `position: absolute` trong vùng cuộn của
   modal. Ảnh 5 cho thấy cách này chạy ổn nhờ `scrollIntoView`, nhưng cần thử lại ở ô ngày
   nằm cuối modal Thêm giao dịch (lịch mở lên trên) và cột phải của modal Định kỳ.
6. **Dọn CSS chết** sau khi thay: `.modal-themed-date-input`, các rule
   `::-webkit-calendar-picker-indicator` (components.css ~7852, modals.css ~3962),
   `.jar-date-input` (dialogs.css ~1897, không còn JSX nào dùng), `color-scheme` cho input
   trong cash-flow.css:94–95.
7. **Kiểm tra lại các form:** TransferModal và RecurringModal có chặn ngày rỗng khi submit
   chưa (TransactionModal đã có ở dòng 299).

### Test
- Unit: bổ sung `tests/date-picker.test.mjs` cho các hàm tháng.
- E2E phải sửa: `tests/cash-flow-browser.cjs` đang `.fill()` vào `cashflow-month-input`
  (dòng 96) và `cashflow-date-input` (227–236). Giữ `data-testid` trên ô nhập/nút tương ứng
  và đổi thao tác sang click ô tháng/ngày.
- Thủ công: 3 theme (sáng, tối, kem) × PC + 375px; gõ tay `29/10/2026`; điều hướng bằng
  phím mũi tên, Esc.

---

## 2 + 3. Thanh "Cần chú ý" (PC ảnh 7, mobile ảnh 8–9, mẫu ảnh 6)

### Có phải thiết kế có chủ đích không?
**Một nửa.** Việc thu gọn danh sách là có chủ đích (để thanh cảnh báo không đẩy cả trang
xuống). Nhưng con số **2 bị viết cứng** —
[PlanOverviewTab.jsx:233](../frontEnd-react/src/features/plan/PlanOverviewTab.jsx#L233)
`activeAlerts.slice(0, 2)` — không phụ thuộc chiều rộng màn hình. Vì vậy trên PC rộng còn
khoảng 40% chỗ trống mà vẫn ẩn 4 việc. Khi bấm *Xem thêm*, các pill có độ rộng không đều và
wrap lộn xộn. Kết luận: **đây là lỗi UX**, không phải dụng ý.

### Các lỗi khác tìm thấy
| # | Lỗi | Nguyên nhân |
|---|---|---|
| a | Thứ tự sai: *Sức khỏe 132%* đứng trước *Chi tiêu khác 960%* (ảnh 7, 9) | Mọi cảnh báo vượt ngân sách cùng `priority: 1`, sort không xét mức độ → giữ thứ tự danh mục |
| b | Mobile: viền đỏ dày hình lưỡi liềm ở mép trái (ảnh 8, 9) | Rule `.is-critical { box-shadow: inset 4px 0 0 … }` (specificity 0,4,0) thắng rule mobile `box-shadow: none` (0,2,0) ở [plan-mobile.css:287](../frontEnd-react/src/assets/css/plan-mobile.css#L287); inset shadow trên card bo góc tạo hình lưỡi liềm |
| c | Mọi thứ đều đỏ: nền gradient đỏ, tiêu đề đỏ, chữ từng dòng đỏ, chấm đỏ nhấp nháy → không còn thứ bậc, gây "mù cảnh báo" | Mức độ chỉ có 2 tầng màu (critical/warning) cho cả card lẫn từng dòng |
| d | Đếm 2 lần: badge **6** + dòng phụ "6 việc cần lưu ý" | `copy.alertCount` lặp lại thông tin của badge |
| e | Mobile: mở rộng 6 dòng chiếm gần trọn màn hình, đẩy các chỉ số xuống dưới | Mở rộng tại chỗ, không giới hạn |
| f | "Thu gọn" bị gạch chân sau khi chạm (ảnh 9) | `:hover { text-decoration: underline }` dính trên màn hình cảm ứng |
| g | "đã vượt 1.719.224 đ (960%)" dễ hiểu nhầm là *vượt 960%* (thực tế là đã dùng 960%, vượt 860%) | Câu chữ ghép số tiền vượt với % đã dùng |

### Thiết kế mới (dùng chung PC + mobile, theo ảnh 6)
**Phân tầng mức độ** — mỗi cảnh báo có một badge và màu nền riêng:

| Tầng | Badge | Ngân sách | Khoản định kỳ | Màu |
|---|---|---|---|---|
| `critical` | **Vượt nhiều** / **Quá hạn** | đã dùng ≥ 150% | quá hạn | đỏ đậm, nền card hồng nhạt |
| `high` | **Đã vượt** / **Hôm nay** | 100–149% | đến hạn hôm nay | đỏ nhạt |
| `watch` | **Sắp chạm** / **Cần theo dõi** / **Còn N ngày** | 70–99% | sắp đến hạn | xám/vàng trung tính |

(Ngưỡng 150% có thể chỉnh. Ảnh 6 dùng "Vượt trung bình"; đề xuất đổi thành "Đã vượt" cho ngắn.)

**Card cảnh báo:** badge tầng → chấm màu + tiêu đề ("Ngân sách Chi tiêu khác") → dòng số
liệu "Vượt **1.719.224 đ** · đã dùng 960%" → chevron. Bấm card thì mở tab tương ứng như
hiện tại.

**Đầu thanh:** chuông + "Cần chú ý" + badge tổng. Dòng phụ đổi thành **tóm tắt theo tầng**,
ví dụ "2 vượt nhiều · 3 đã vượt · 1 sắp chạm", thay cho câu lặp số. Bỏ gradient đỏ toàn
card và viền lưỡi liềm; màu do từng card con thể hiện. Card ngoài chỉ nhuộm nhẹ theo tầng
cao nhất.

**PC (> 600px):** các card xếp thành lưới đều cột
(`repeat(auto-fill, minmax(240px, 1fr))`). Số card hiện = **số cột vừa một hàng**, đo bằng
`ResizeObserver` (thường 3–4 ở 1440px, 2 ở tablet). Nút "Xem thêm N việc" đếm đúng số đang ẩn.
Khi mở rộng, các hàng sau thẳng cột với hàng đầu (không còn pill so le).

**Mobile (≤ 600px):** card xếp dọc, hiện **2 việc nặng nhất**. "Xem tất cả 6 việc" mở
**bottom sheet** liệt kê đủ, nhóm theo tầng, có nút đóng. Trang phía sau không bị đẩy.
Dùng lại `useFocusTrap` và `useBodyScrollLock` có sẵn trong `hooks/`. Bỏ gạch chân khi hover
trên thiết bị cảm ứng (`@media (hover: hover)`).

### Cách làm
1. Chuyển logic dựng cảnh báo trong `useMemo` của PlanOverviewTab (dòng 135–231) sang hàm
   thuần `utils/planAlerts.js`: trả về `{ id, kind, tier, title, amountText, usageText,
   targetTab, dateParts }` và sort theo `tier`, rồi theo mức vượt (số tiền / %), rồi theo
   ngày đến hạn. Thêm `tests/plan-alerts.test.mjs` (phân tầng, thứ tự 960% > 132%, khoản đã
   trả không hiện).
2. Viết lại JSX khối cảnh báo thành `PlanAttentionBar` (file riêng trong `features/plan/`)
   và `AttentionSheet` cho mobile.
3. CSS: thay bộ rule `.plan-top-alerts-card` / `.top-alert-pill-item` ở components.css
   (~4536–4720, 5426) và plan-mobile.css (26–230, 287–310) bằng một file
   `plan-attention.css`, dùng token `--alert-*` có sẵn và thêm token cho tầng `watch`.
   Kiểm tra cả 3 theme.
4. Câu chữ vi/en/zh trong `planCopy.js` (badge tầng, tóm tắt, "Xem tất cả").
5. Sửa `tests/mobile-ux-browser.cjs:289–295` (đang dựa vào `.top-alert-pill-item`, 2 → 4
   dòng tại chỗ) cho đúng hành vi mới (2 card + bottom sheet).

---

## 4. Dropdown "Loại" và "Ví" tràn khỏi màn hình (ảnh 10–12)

### Nguyên nhân (đã xác định)
[transaction-inspection.css:565](../frontEnd-react/src/assets/css/transaction-inspection.css#L565):

```css
.transaction-filter-dropdown.is-compact .transaction-filter-menu {
  left: auto;            /* + right: 0 từ rule gốc */
  min-width: max(100%, 190px);
  max-width: min(320px, calc(100vw - 32px));
}
```

Menu luôn **neo vào mép phải của nút** và mở rộng sang trái. `max-width` chỉ giới hạn độ
rộng, không giới hạn vị trí.
- "Loại" và "Ví" nằm ở **cột trái** và là hai nút hẹp nhất (~110–130px). Menu rộng tối
  thiểu 190px, riêng "Ví" rộng tới 320px vì tên dài như "Techcombank (Định kỳ).", nên
  lòi ra ngoài mép trái màn hình.
- "Danh mục" và "Thời gian" nằm **cột phải**, bên trái còn đủ chỗ nên trông như vẫn ổn.
- Trên PC các nút đều dồn về bên phải (`justify-content: flex-end`), nên lỗi chưa từng lộ.

### Giải pháp đề xuất
1. Tạo hook dùng chung `hooks/useAnchoredPlacement.js`: khi mở menu, đo
   `getBoundingClientRect()` của nút. Neo trái nếu `rect.right - menuWidth < 16`, ngược lại
   neo phải. Mở lên trên nếu bên dưới thiếu chỗ. Nếu cả hai phía đều không đủ thì kẹp vào
   khung `[16px, innerWidth - 16px]`. `CustomDatePicker` hiện đã có một bản rút gọn của
   logic này (`placement.alignRight`), nên chuyển nó sang dùng hook chung luôn.
2. `TransactionFilterDropdown` dùng hook này và thêm class `is-align-left` / `is-align-right`
   / `is-above`. CSS bỏ `left: auto` cứng.
3. Áp dụng tương tự cho `CustomSelect` và `CustomWalletDropdown`: hiện chưa có logic đặt vị
   trí nào, nên dễ dính cùng lỗi ở các màn hình khác.
4. Test hồi quy: thêm vào `tests/mobile-ux-browser.cjs` một ca ở viewport 375px, mở lần lượt
   4 dropdown và kiểm tra `rect.left >= 0 && rect.right <= innerWidth`.

Phương án đã cân nhắc và không chọn:
- Chỉ sửa CSS thành `left: 0`: lại tràn phải với "Danh mục" và "Thời gian".
- CSS Anchor Positioning (`position-try-fallbacks`): chưa đủ trình duyệt hỗ trợ.

Nếu chọn phương án B ở mục 5, mobile sẽ dùng bottom sheet thay menu nên lỗi này biến mất
trên điện thoại. Hook trên vẫn cần cho PC và tablet.

---

## 5. Thiết kế lại khung bộ lọc Lịch sử giao dịch (ảnh 13)

### Vấn đề hiện tại (mobile, khi đang lọc 2 điều kiện)
Từ ô tìm kiếm tới giao dịch đầu tiên có **7 hàng điều khiển**: tìm kiếm + nút Bộ lọc → 2
hàng dropdown → hàng công tắc + "Xóa bộ lọc" → hàng chip → "Xóa tất cả" → dòng tổng.
- **Một trạng thái hiển thị 3 lần:** badge "2" trên nút Bộ lọc, dropdown được tô màu, và chip
  "Ví: ZaloPay ×".
- **Hai nút xoá trùng nhau** ("Xóa bộ lọc" và "Xóa tất cả") mà nút nào cũng không nổi bật.
  "Xóa bộ lọc" trông y như một ô lọc nữa; khi bị vô hiệu hoá thì trông gần như lúc đang bật.
- **Công tắc "Ẩn khoản định kỳ"** là một kiểu điều khiển khác nhưng nằm lẫn trong hàng dropdown.
- **Nhãn bị cắt:** "Danh mục: Mọi da…", "Thời gian: Mọi thời…". Chữ "Mọi …" của giá trị
  mặc định chiếm chỗ mà không mang thông tin.

### Các mẫu thiết kế phổ biến ở app/web khác
| Mẫu | Ví dụ thường gặp | Ưu | Nhược |
|---|---|---|---|
| **A. Hàng chip lọc cuộn ngang**: mỗi chip vừa là nút mở, vừa hiện giá trị đang lọc | Gmail và Google Photos (khi tìm kiếm), Google Maps, các app ngân hàng mới | 1 hàng duy nhất; trạng thái nằm ngay trên nút; không cần hàng chip riêng | Chip cuối có thể bị khuất (cần gợi ý cuộn); menu không neo được trong vùng cuộn ngang → phải dùng sheet |
| **B. Nút "Bộ lọc" mở bottom sheet**: chân sheet cố định có "Đặt lại" + "Xem 99 kết quả" | Airbnb, Shopee, Lazada, Tiki | Chỗ rộng cho nhiều tiêu chí; nút xoá nằm cố định, dễ thấy; chọn nhiều thứ rồi áp dụng một lần | Thêm một bước bấm; không thấy kết quả thay đổi trực tiếp |
| **C. Thanh tóm tắt dạng câu**: "99 giao dịch · ZaloPay · Tháng này · ✕ Xoá lọc" | Kiểu tóm tắt ngắn của nhiều app ví / ngân hàng | Gọn nhất | Muốn sửa từng điều kiện vẫn phải mở panel |

Các nghiên cứu (Baymard, NN/g, Material) thống nhất ở mấy điểm: luôn cho thấy **tổng quan
bộ lọc đang áp dụng**; có **một** nút xoá tất cả, trông như đang bấm được chứ không mờ như bị
khoá; hiện **số kết quả**; trên mobile thì hàng chip nên một hàng cuộn ngang; còn khi bộ lọc
nhiều tiêu chí, dùng sheet.

### Đề xuất cho CaltDHy: **A + B kết hợp**
```
[🔍 Tìm mô tả hoặc danh mục          ] [⚙ 2]     ← nút mở sheet đầy đủ (mẫu B)
[✕ Xoá lọc] [Loại ▾] [Danh mục ▾] [ZaloPay ▾] [Tháng này ▾] [Không gồm định kỳ]   → cuộn ngang
99 / 224 giao dịch · Chi 5.364.780 đ · Thu 0 đ
```
- **Một hàng chip** thay cho cả hai hàng dropdown và hàng chip đang lọc. Khi chưa lọc, chip
  viền mảnh ghi tên tiêu chí ("Ví ▾"). Khi đang lọc, chip tô màu ghi **giá trị** ("ZaloPay ▾"),
  nên không cần hàng chip riêng nữa.
- **"✕ Xoá lọc (2)"** là chip đầu hàng, chỉ xuất hiện khi có lọc, màu tương phản. Đây là
  nút xoá **duy nhất** và luôn nằm trong tầm mắt.
- "Ẩn khoản định kỳ" → **chip bật/tắt** "Không gồm định kỳ" (có dấu ✓ khi bật), cùng ngôn
  ngữ hình ảnh với các chip khác.
- **Mobile:** bấm chip thì mở **bottom sheet** của riêng tiêu chí đó (danh sách lựa chọn
  to, dễ chạm; "Tùy chọn ngày" hiện hai ô lịch trong sheet). Nút ⚙ mở sheet tổng có đủ mọi
  tiêu chí, chân sheet có "Đặt lại" + "Xem N giao dịch". Cách này cũng xoá luôn gốc rễ của
  lỗi mục 4 trên điện thoại.
- **PC:** chip wrap tự nhiên cạnh ô tìm kiếm (không cuộn), mở menu thả xuống đã sửa vị trí ở
  mục 4. Không cần sheet.
- Hai hàng (tìm kiếm + chip) thay cho 7, danh sách giao dịch hiện lên sớm hơn khoảng 300px
  trên điện thoại.

Phương án nhẹ hơn (nếu muốn ít thay đổi): giữ cấu trúc hiện tại, chỉ (1) bỏ hàng chip trùng
lặp, (2) gộp hai nút xoá thành một và đưa lên cạnh nút Bộ lọc, (3) đổi công tắc thành chip.
Làm nhanh hơn nhưng vẫn còn 4–5 hàng.

### Phần việc kỹ thuật (theo phương án đề xuất)
- `TransactionFilterDropdown` → `FilterChip` (props: `label`, `valueLabel`, `active`,
  `onOpen`) + `FilterSheet` cho mobile (dùng `useFocusTrap`, `useBodyScrollLock`) + menu thả
  xuống cho PC (dùng `useAnchoredPlacement`).
- `TransactionHistoryView.jsx` (dòng 180–260): bỏ khối `transaction-active-filters` và nút
  `transaction-history-clear`; dữ liệu `activeFilters` có sẵn được dùng lại để vẽ chip.
- Câu chữ vi/en/zh trong `historyFilterCopy.js`.
- Sửa `tests/ux-polish-browser.cjs:116–149`, hiện đang bám vào `.transaction-filter-dropdown`,
  `.transaction-active-filters` và `.transaction-filter-chip`.

---

## Thứ tự thực hiện đề xuất
1. **Mục 4** (dropdown tràn): nhỏ, an toàn, sửa được ngay; tạo hook dùng lại cho mục 1 và 5.
2. **Mục 1** (lịch chọn ngày): độc lập, 6 chỗ thay + 1 component tháng.
3. **Mục 2 + 3** (Cần chú ý): sau khi chốt ngưỡng tầng và câu chữ badge.
4. **Mục 5** (bộ lọc): sau khi chọn phương án (đề xuất A + B, hoặc bản nhẹ).

Mỗi mục: `npm test`, `npm run lint --prefix frontEnd-react`, browser test liên quan, và
xem bằng mắt ở 375px + 1440px trong 3 theme.

## Cần chốt trước khi làm
- Mục 2/3: ngưỡng "Vượt nhiều" = 150% có ổn không; mobile dùng bottom sheet hay mở rộng tại chỗ.
- Mục 5: phương án A + B (đề xuất) hay bản nhẹ.

## Ngoài phạm vi (thấy khi xem ảnh)
- Ảnh 1–2: thẻ "Kế hoạch tháng này" và "Cảnh báo" ở Trang chủ hiện tên danh mục tiếng Anh
  ("Other Expense", "Food & Dining") trong khi chỗ khác là tiếng Việt. Có vẻ thiếu `label()`
  ở `AttentionPanel`.

## Đã chốt và kết quả (29/10/2026)
- Mục 2/3: ngưỡng "Vượt nhiều" = 150%; mobile dùng bottom sheet. Nhóm tóm tắt dùng tên tầng
  chung (nghiêm trọng / cần xử lý / cần theo dõi) vì một tầng có thể gồm cả hoá đơn quá hạn lẫn
  ngân sách; badge trên từng thẻ vẫn nói cụ thể (Vượt nhiều, Đã vượt, Quá hạn, Còn N ngày…).
- Mục 5: phương án A + B. Giữ nhãn "Xóa bộ lọc" và "Ẩn khoản định kỳ" có sẵn trong bản dịch.
- Lịch gõ tay: gõ đủ một ngày hợp lệ là áp dụng ngay (như ô ngày gốc), không cần rời ô.
- Test: `npm test` pass; browser test ux-polish, browser-security, transaction-period, cash-flow,
  theme-contrast, mobile-section-nav, ux-budget pass. mobile-ux còn 1 lỗi `.jar-next-strip` ở
  kịch bản Hũ — lỗi này đã có sẵn ở commit `9c8fcaa`, không liên quan các thay đổi trên.

