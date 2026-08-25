# CaltDHy — Đặc tả triển khai UX/UI v2

> Tài liệu bàn giao cho agent triển khai. Đây là **đặc tả sản phẩm và giao diện có tính bắt buộc** cho đợt redesign, không phải danh sách ý tưởng để chọn lọc. Khi có mâu thuẫn giữa UI cũ và tài liệu này, ưu tiên tài liệu này. Không thay đổi nghiệp vụ/dữ liệu hiện có trừ khi cần để sửa lỗi được nêu rõ.

## 1. Mục tiêu redesign

CaltDHy là ứng dụng quản lý tài chính cá nhân cho người dùng Việt Nam. Mục tiêu không phải là hiển thị càng nhiều chỉ số càng tốt; mục tiêu là giúp người dùng trả lời nhanh và tự tin:

1. **Hôm nay tôi còn có thể chi bao nhiêu?**
2. **Tôi vừa chi/thu gì và có cần sửa không?**
3. **Tháng này danh mục hoặc hoá đơn nào cần tôi hành động?**
4. **Mục tiêu tiết kiệm của tôi đang tiến triển thế nào?**

Giao diện cần tạo cảm giác rõ ràng, thân thiện, đáng tin cậy và gọn gàng. Không dùng cách thể hiện kiểu “technical control panel” làm giảm khả năng đọc số tiền. Giữ tính cách thương hiệu xanh của CaltDHy, nhưng giảm các chi tiết trang trí như ốc vít, bóng đổ dày, chữ mono viết hoa dày đặc.

### Chỉ số thành công UX

- Người dùng thêm một giao dịch chi tiêu thông thường trong không quá 10 giây trên desktop và 15 giây trên mobile.
- Khi mở Trang chủ, người dùng thấy “Tiền có thể chi còn lại” mà không cần cuộn.
- Người dùng hiểu được khác biệt giữa tiền khả dụng, số dư ví, tiền hũ và ngân sách danh mục.
- Không có dữ liệu tài chính nào bị mặc định sai loại giao dịch, sai danh mục, hay sai ví.
- Mọi thao tác quan trọng đều có phản hồi thành công/lỗi rõ ràng; thao tác xoá cần xác nhận.

## 2. Phạm vi và giới hạn

### Trong phạm vi

- Redesign UI React tại `frontEnd-react/`.
- Thay cấu trúc điều hướng hiện tại bằng bốn khu vực: **Trang chủ / Kế hoạch / Phân tích / Hũ chi tiêu**.
- Loại bỏ left rail cố định khỏi app shell desktop và mobile.
- Thiết kế lại Trang chủ, Kế hoạch, Phân tích, Hũ chi tiêu và luồng thêm giao dịch.
- Chuẩn hoá tiếng Việt, định dạng tiền tệ và date locale.
- Bổ sung responsive, accessibility, empty/loading/error/destructive states.

### Ngoài phạm vi trừ khi cần để UI hoạt động

- Viết lại toàn bộ backend hoặc thay database.
- Thay đổi luồng xác thực, đăng ký, đăng nhập, xác minh email.
- Tạo tính năng đầu tư, đồng bộ ngân hàng thật hoặc chia sẻ ngân sách nhiều người.
- Tạo biểu đồ phức tạp chỉ để lấp chỗ trống.

### Ràng buộc kỹ thuật

- Giữ React/Vite và các store/service hiện có khi khả thi.
- Tái sử dụng endpoint và model hiện hữu cho transaction, budget, wallet, jar, installment.
- Không dùng dữ liệu giả trong bản hoàn thiện nếu API đã cung cấp dữ liệu thật.
- Không để inline style dàn trải trong component mới. Dùng class có tên theo component và CSS token thống nhất.
- Không thay đổi hoặc xoá các phần không liên quan đang có trong worktree.

## 3. Kiến trúc thông tin bắt buộc

### Điều hướng chính

Thanh topbar desktop chứa, theo thứ tự:

1. Logo CaltDHy (về Trang chủ).
2. Điều hướng text: `Trang chủ` · `Kế hoạch` · `Phân tích` · `Hũ chi tiêu`.
3. Bên phải: chọn/thể hiện tháng hiện tại khi phù hợp, `+ Thêm giao dịch`, menu tài khoản.

Trên desktop, nhãn text phải được hiển thị; icon chỉ là bổ trợ, không thay thế nhãn. Nút đang chọn có background mint nhạt và chữ xanh đậm; không dùng underline nhỏ khó nhận biết làm tín hiệu duy nhất.

Không giữ sidebar/left rail cũ. Không dồn các thống kê tháng, biểu đồ donut và CTA trùng lặp vào một rail cố định.

### Bản đồ nội dung

| Khu vực | Mục đích chính | Nội dung bắt buộc | Không đặt ở đây |
|---|---|---|---|
| Trang chủ | Điều hành tài chính trong ngày | Tiền có thể chi, giao dịch gần đây, trạng thái ngân sách ngắn, cảnh báo/hóa đơn gần nhất | Quản trị ví chi tiết, biểu đồ lịch sử lớn |
| Kế hoạch | Thiết lập cấu trúc tài chính tháng | Ví & tài khoản, ngân sách danh mục, khoản định kỳ | Lịch sử giao dịch đầy đủ, biểu đồ phân tích |
| Phân tích | Hiểu quá khứ và ra quyết định | Xu hướng, phân bổ, so sánh, insight có hành động | Form cấu hình ngân sách dài |
| Hũ chi tiêu | Theo dõi và thao tác với mục tiêu | Thẻ hũ, tiến độ, nạp/rút, lịch sử hũ | Các ví thanh toán thông thường |

`Hũ chi tiêu` giữ là top-level vì đây là mental model và tác vụ riêng (mục tiêu, nạp/rút), không phải một sub-tab “cài đặt”. Nếu product research sau này chứng minh tần suất mở hũ thấp, mới cân nhắc đưa nó vào Kế hoạch.

## 4. Nền tảng UI chung

### Ngôn ngữ, số và thuật ngữ

- Giao diện tiếng Việt mặc định và nhất quán. Không hiển thị lẫn `Dashboard`, `Analytics`, `Jars`, `Welcome`, `LOG OUT`, `Salary` trong UI tiếng Việt.
- Format ngày bằng `vi-VN`; ví dụ `Thứ Hai, 24 tháng 8, 2026` hoặc `24 thg 8` trong list dày.
- Format tiền bằng `vi-VN`, không có số lẻ: `2.670.000 đ`. Dấu âm/chỉ chi tiêu: `−35.000 đ`; thu nhập: `+3.000.000 đ`.
- Dùng đúng thuật ngữ:
  - **Tiền có thể chi**: số tiền còn dùng được sau khi tính các khoản đã dành/không khả dụng theo quy tắc sản phẩm.
  - **Số dư ví**: tiền của riêng từng ví/tài khoản.
  - **Ngân sách**: hạn mức chi theo danh mục trong tháng.
  - **Hũ**: tiền dành cho mục tiêu tiết kiệm.
  - **Khoản định kỳ**: khoản phải thu/chi lặp lại.

### Màu sắc và hierarchy

Giữ light theme làm mặc định. Gợi ý token (agent có thể tinh chỉnh giá trị nhưng không đổi ý nghĩa):

| Vai trò | Gợi ý | Quy tắc sử dụng |
|---|---|---|
| Nền trang | `#F5FAF7` | Rất nhẹ, không ngả xanh quá mạnh |
| Surface/card | `#FFFFFF` | Card có border nhẹ, shadow tối thiểu |
| Chữ chính | `#173126` | Dùng cho tiêu đề và số chính |
| Chữ phụ | `#60766A` | Không dùng cho nội dung bắt buộc đọc ở cỡ nhỏ |
| Primary/positive | `#078A59` | CTA, thu nhập, progress an toàn |
| Primary hover | `#056C46` | Hover/focus CTA |
| Cảnh báo | `#B7791F` / vàng nền nhạt | Gần chạm ngân sách, hóa đơn gần hạn |
| Nguy hiểm/chi | `#C94B45` | Chi tiêu, vượt ngân sách, xóa |
| Focus ring | xanh primary, có độ tương phản cao | Tất cả control keyboard |

Không truyền đạt trạng thái chỉ bằng màu. Ví dụ thanh ngân sách cần đồng thời có text `Còn 100.000 đ` hoặc `Đã dùng 88%`.

### Typography và spacing

- Dùng một sans-serif dễ đọc có hỗ trợ tiếng Việt; ưu tiên Inter hoặc IBM Plex Sans. Mono chỉ dùng giới hạn cho mã/metadata, không dùng cho hầu hết tiêu đề và số tiền.
- Không viết toàn bộ label bằng chữ in hoa. Nhãn section dùng sentence case: `Giao dịch gần đây`, không phải `LỊCH SỬ GIAO DỊCH`.
- Body tối thiểu 14px; metadata 12px chỉ dùng khi vẫn có contrast tốt; label form tối thiểu 13px; nút tối thiểu 14px.
- Số tiền chủ đạo trên Home: 40–48px desktop, 32–36px mobile.
- Spacing scale: 4, 8, 12, 16, 24, 32, 40px. Card có radius 12–16px; không cần hiệu ứng giả lập kim loại/ốc vít.

### Layout desktop

- Header cao 64–72px, sticky khi scroll; không quá tải icon.
- Container nội dung: `width: min(calc(100% - 48px), 1680px)` và `margin-inline: auto`.
- Padding ngang: 24px ở desktop thông thường, 32px ở >=1440px.
- Không đặt `max-width: 1100px/1160px` cho toàn bộ Home desktop; đó là nguyên nhân gây cảm giác bé và trống trên màn hình lớn.
- Home grid: cột chính `minmax(0, 1.7fr)` và cột phụ `minmax(320px, 0.8fr)`, gap 24px.
- Không kéo một hàng card nhỏ ngang toàn màn hình. Khi màn hình lớn, giữ card đọc được, dùng 2 cột có hierarchy thay vì năm card kích thước cố định nằm ở góc trái.

### Layout responsive

- `>= 1280px`: layout desktop hai cột.
- `768–1279px`: desktop/tablet ngang; grid có thể giữ 2 cột nếu cột phụ >=280px, nếu không chuyển xuống dưới cột chính.
- `<768px`: header gọn với logo, menu/tabs cuộn ngang hoặc menu rõ ràng, CTA `+` có aria-label; nội dung một cột; không xếp lại sidebar vì sidebar không còn tồn tại.
- Mobile ưu tiên thứ tự: tiền có thể chi → CTA giao dịch → cảnh báo → giao dịch gần đây → kế hoạch tóm tắt.
- Kích thước tap target tối thiểu 44×44px.

## 5. Đặc tả từng màn hình

### 5.1 Trang chủ (`home`)

#### Mục đích

Cho người dùng biết tình hình hiện tại và hoàn tất thao tác phổ biến nhất: thêm/sửa giao dịch.

#### Nội dung desktop, theo thứ tự

1. **Page heading**
   - `Tháng 8 của bạn đang ổn` hoặc wording phản ánh trạng thái thực tế, không bịa insight khi dữ liệu không đủ.
   - Metadata nhỏ: `Cập nhật lần cuối hôm nay, 10:42` chỉ hiển thị khi có ý nghĩa.
   - CTA duy nhất nổi bật: `+ Thêm giao dịch`.

2. **Hero “Tiền có thể chi còn lại”** (cột chính)
   - Label: `Tiền có thể chi còn lại`.
   - Số lớn.
   - Helper text: `Sau chi tiêu thiết yếu và tiền đã dành cho mục tiêu.` Chỉ giữ nếu logic thực sự đúng.
   - Footer 2 chỉ số: `Đã chi tháng này` và `Thu nhập tháng này`.
   - Không gọi hero là `Tổng số dư` vì đó là khái niệm khác với tiền người dùng có thể tiêu.

3. **Kế hoạch tháng này** (cột phụ)
   - Hiển thị tối đa 3 danh mục cần chú ý nhất: gần hạn mức, vượt hạn mức, hoặc chi tiêu cao nhất.
   - Mỗi dòng có: tên danh mục, `đã chi / hạn mức`, progress bar và text phần trăm/còn lại.
   - Link text `Xem toàn bộ ngân sách →` dẫn Kế hoạch > Ngân sách.
   - Nếu chưa có budget: empty state ngắn + CTA `Đặt ngân sách`.

4. **Giao dịch gần đây** (cột chính, dưới hero)
   - Tối đa 5–7 giao dịch gần nhất; có link `Xem tất cả` tới list/lọc giao dịch hợp lý.
   - Mỗi row: icon danh mục, tên/ghi chú, `Danh mục · Ví · thời gian`, số tiền căn phải, dấu +/- và màu phụ trợ.
   - Click row mở modal chỉnh sửa hoặc detail sheet.
   - Xóa không đặt dạng icon thùng rác luôn hiện ở mỗi hàng; dùng menu `…` hoặc chi tiết, sau đó confirm.
   - Empty state: `Chưa có giao dịch nào trong tháng này` + CTA `Thêm giao dịch đầu tiên`.

5. **Cảnh báo và sắp tới** (cột phụ, dưới kế hoạch)
   - Tối đa 2 alert có hành động: ngân sách gần vượt, hóa đơn sắp hạn, số dư ví thấp.
   - Chỉ xuất hiện khi dữ liệu kích hoạt alert. Không tạo card rỗng.
   - Bên dưới là 1–2 hũ quan trọng nhất, tên + số còn thiếu + progress; link `Xem hũ`.

#### Không đặt trên Home

- Toàn bộ danh sách ví.
- Năm thẻ ngân sách ngang hàng.
- Donut chart lớn cố định.
- Chart tháng có nhiều ngày trống.
- Banner onboarding luôn hiển thị. Onboarding chỉ hiện trong tối đa 3 lần đầu hoặc đến khi hoàn tất; có nút `Ẩn hướng dẫn` và lưu trạng thái.

### 5.2 Kế hoạch (`plan`)

#### Mục đích

Đây là nơi người dùng quản lý cấu trúc và cam kết tài chính tháng, không phải một dashboard thứ hai.

#### Header và sub-navigation

- Title `Kế hoạch tài chính`.
- Month selector ở header của nội dung: mũi tên trái/phải + `Tháng 8, 2026`. Selector dùng chung cho Ngân sách và Định kỳ; Ví không nhất thiết phụ thuộc tháng.
- Sub-tab: `Ví & tài khoản` · `Ngân sách` · `Khoản định kỳ`.
- URL/state phải cho phép mở trực tiếp đúng tab nếu routing hiện có hỗ trợ; nếu không, giữ state rõ ràng trong store.

#### Tab Ví & tài khoản

- Tổng quan gọn đầu trang:
  - `Tiền khả dụng`.
  - `Trong hũ` (nếu được tính tách).
  - `Nợ/thẻ tín dụng` nếu dữ liệu có.
- Danh sách ví theo card/row, không phải card quá lớn:
  - Icon + tên ví + loại + số dư + trạng thái mặc định.
  - Nút `+ Thêm ví`; action `Chuyển tiền` chỉ enable khi có ít nhất 2 ví phù hợp.
- Form tạo ví là modal 2 bước nhẹ:
  1. **Thông tin cần thiết:** tên ví, loại, số dư ban đầu.
  2. **Tùy chỉnh (optional):** icon, màu, checkbox “Không tính vào tiền khả dụng”.
- Không dùng title `Tạo ví mới để chuyển tiền`; title chính xác là `Thêm ví / tài khoản mới`.
- Số dư đầu vào có VND prefix/suffix, input mask/format ngăn nhập số không hợp lệ. Giải thích checkbox bằng helper text đơn giản.

#### Tab Ngân sách

- Hiển thị danh sách danh mục với: budget, đã chi, còn lại/vượt, progress và trạng thái text.
- Sắp thứ tự: vượt hạn mức → gần hạn mức → đang hoạt động → chưa có chi tiêu.
- Chọn một danh mục mở form sửa inline hoặc modal, không đặt input number cho mọi dòng mà yêu cầu bấm `Lưu ngân sách` chung.
- CTA rõ: `Đặt ngân sách`. Có template tuỳ chọn “phân bổ theo tháng trước”, nhưng không tự áp dụng.
- Cảnh báo mốc: `<75%` bình thường; `75–99%` chú ý; `>=100%` vượt. Màu luôn đi kèm label.

#### Tab Khoản định kỳ

- Hiển thị theo thời điểm đến hạn; trạng thái: `Sắp đến hạn`, `Đã đến hạn`, `Đã thanh toán`, `Tạm dừng`.
- Mỗi item: tên, số tiền, loại (thu/chi), chu kỳ, ngày kế tiếp và CTA `Đánh dấu đã trả`.
- Bấm `Đánh dấu đã trả` tạo/ghi nhận transaction đúng loại theo quy tắc backend hiện có và đưa confirmation toast kèm Undo nếu có thể.
- Tạo/sửa khoản định kỳ trong modal có label đầy đủ; không phải một form grid không nhãn.
- Xóa/tạm dừng phải có confirmation phù hợp; tạm dừng không cần confirmation nếu dễ hoàn tác.

### 5.3 Phân tích (`analytics`)

#### Mục đích

Biến lịch sử thành nhận định và hành động, không chỉ vẽ chart.

#### Nội dung

- Header: `Phân tích chi tiêu` + month/range selector nằm cùng hàng với nội dung phân tích, không tách xa chart.
- Summary: Thu nhập, Chi tiêu, Dòng tiền ròng. Giữ tối đa 3 metric.
- Insight ưu tiên (khi đủ dữ liệu), ví dụ:
  - `Bạn đã dùng 88% ngân sách Di chuyển; còn 100.000 đ cho 7 ngày.` + CTA `Điều chỉnh ngân sách`.
  - `Chi tiêu ăn uống tăng 24% so với tháng trước.` + CTA `Xem giao dịch`.
- Biểu đồ phân bổ theo danh mục: bar chart ngang với nhãn và số tiền trực tiếp. Ưu tiên vì dễ so sánh hơn donut.
- Biểu đồ xu hướng: chỉ hiển thị khi có đủ dữ liệu (ví dụ >=3 ngày giao dịch). Mặc định 7/30 ngày hoặc theo tháng; tránh chart 31 ngày rỗng.
- Có rõ legend, tooltip/label có thể đọc; không dựa vào đỏ/xanh để phân biệt series.
- Empty state: giải thích phân tích sẽ xuất hiện sau khi có giao dịch, CTA `Thêm giao dịch`.

### 5.4 Hũ chi tiêu (`jars`)

#### Mục đích

Tạo động lực theo mục tiêu nhưng phải giữ cảm giác tài chính đáng tin cậy, không quá game hóa.

#### Nội dung

- Header `Hũ chi tiêu` + CTA `+ Tạo hũ`.
- Summary nhẹ: `Tổng đã tích lũy` và `Tiến độ trung bình` khi có hũ; không bắt buộc tạo những card lớn nếu dữ liệu ít.
- Card hũ gồm: emoji/icon nhỏ, tên, `hiện có / mục tiêu`, progress, số còn thiếu, ngày mục tiêu (nếu có), CTA `Nạp` và `Rút`.
- Nạp/Rút mở dialog nhẹ: số tiền, nguồn/đích ví (nếu nghiệp vụ hỗ trợ), ghi chú optional, preview tác động đến số dư. Không để input số tiền và hai nút hành động trên card gây nhầm lẫn.
- Xóa hũ phải confirmation, nêu rõ xử lý số tiền còn lại theo nghiệp vụ.
- Empty state: minh hoạ đơn giản + text `Tạo hũ đầu tiên cho mục tiêu của bạn` + CTA.

## 6. Luồng giao dịch toàn cục (bắt buộc sửa)

### Một CTA chính

`+ Thêm giao dịch` là entry point nổi bật duy nhất. Có thể xuất hiện ở topbar và empty state, nhưng phải mở **cùng một modal/sheet**.

Không dùng FAB hình bút riêng mang nghĩa mơ hồ. Không để “Quick deposit” và “Ghi giao dịch” mở hai luồng có nghiệp vụ khác nhau trừ khi có nhãn rõ ràng.

### Modal thêm giao dịch

Trình tự tối ưu:

1. Toggle `Chi tiêu` / `Thu nhập`, mặc định **Chi tiêu** khi người dùng bấm `+ Thêm giao dịch`; không tự đổi lại khi chưa có lý do.
2. `Số tiền` là trường focus đầu tiên; keyboard numeric trên mobile; format nhóm nghìn realtime.
3. `Danh mục`: lựa chọn gần đây/gợi ý ở đầu; có danh mục mặc định hợp lệ theo type.
4. `Chi từ / Nhận vào`: chọn ví, preselect ví mặc định nhưng hiển thị rõ.
5. `Ngày`: mặc định hôm nay, cho phép đổi.
6. `Ghi chú` optional.
7. CTA `Lưu giao dịch` (hoặc `Cập nhật giao dịch`).

Sau lưu thành công:

- Đóng modal, update ngay Trang chủ / ngân sách / ví liên quan.
- Toast: `Đã ghi chi tiêu 35.000 đ vào Ăn uống.`
- Cung cấp `Hoàn tác` trong thời gian ngắn nếu implementation có thể rollback an toàn.

### Quy tắc dữ liệu không được vi phạm

- Tuyệt đối không hard-code mọi giao dịch từ numpad là `income`, category `Salary`, hoặc “Nạp nhanh”. Đây là lỗi dữ liệu tài chính nghiêm trọng cần loại bỏ.
- Không mặc định ví hoặc danh mục mà không cho người dùng nhìn thấy/chỉnh sửa.
- Transfer giữa hai ví không được xuất hiện như một khoản chi/thu làm sai báo cáo nếu backend đã có quy tắc transfer.
- Khi số dư âm được phép, UI cần giải thích (ví dụ thẻ tín dụng/nợ); khi không được phép, chặn trước khi lưu và nói rõ lý do.

## 7. Empty, loading, error, confirmation

Mỗi module phải có các trạng thái sau:

| Trạng thái | Cách thể hiện |
|---|---|
| Loading | Skeleton theo bố cục thật, không màn hình trống hay spinner giữa trang |
| Empty | Một câu nêu giá trị + một CTA liên quan trực tiếp; không dùng minh hoạ quá lớn |
| API error | Message dễ hiểu + nút `Thử lại`; không chỉ log console |
| Save success | Toast ngắn, có Undo khi hợp lý |
| Validation error | Ngay dưới field, nêu cách sửa; focus field lỗi đầu tiên |
| Destructive action | Confirmation modal nêu đối tượng và hệ quả; button nguy hiểm có wording cụ thể |

Các modal mới phải có `role="dialog"`, `aria-modal="true"`, title được liên kết qua `aria-labelledby`, trap focus, đóng bằng Escape, click backdrop theo chính sách nhất quán, và return focus về control đã mở modal.

## 8. Accessibility và chất lượng tương tác

- Mục tiêu tối thiểu WCAG AA: tương phản text bình thường >= 4.5:1, text lớn >= 3:1.
- Mọi button/icon button có accessible name; tooltip không thay thế accessible name.
- Có focus-visible rõ ràng trên light theme. Không dùng box-shadow focus tối trên nền trắng khó thấy.
- Kiểm tra toàn bộ luồng bằng keyboard: topbar → CTA → modal → save/cancel → toast.
- Hỗ trợ `prefers-reduced-motion`; transition <=200ms và không gây layout shift.
- Không chỉ dùng icon cho action quan trọng; icon-only button có title/aria-label.
- Chart phải có text/summary tương đương cho screen reader hoặc bảng tóm tắt dữ liệu.

## 9. Hướng dẫn kỹ thuật cho codebase hiện tại

### Cấu trúc đề xuất

Agent cần khảo sát cấu trúc hiện có trước khi sửa. Hướng tổ chức mong muốn:

```text
frontEnd-react/src/
  components/
    layout/
      AppShell.jsx              # topbar + main, không còn LeftRail cố định
      Topbar.jsx                # nav bốn mục + global CTA
    ui/
      TransactionModal.jsx      # dialog chuẩn, dùng chung mọi entry point
      ConfirmDialog.jsx
      ToastRegion.jsx
      EmptyState.jsx
      MoneyAmount.jsx
  features/
    home/
      HomeView.jsx
      AvailableToSpendCard.jsx
      RecentTransactions.jsx
      AttentionPanel.jsx
    plan/
      PlanView.jsx
      WalletsTab.jsx
      BudgetsTab.jsx
      RecurringTab.jsx
    analytics/
      AnalyticsView.jsx
    jars/
      JarsView.jsx
  styles/
      tokens.css
      app-shell.css
      home.css
      plan.css
      analytics.css
      jars.css
      dialogs.css
      responsive.css
```

Tên/file có thể điều chỉnh để phù hợp project nhưng phải giữ ranh giới feature rõ ràng. Không tiếp tục tăng kích thước một file CSS components khổng lồ.

### State/routing

- Thay `activeView` cũ `home/analytics/jars` bằng `home/plan/analytics/jars`; các nhãn UI tương ứng là tiếng Việt.
- Nếu có thể, dùng route có URL rõ: `/spending`, `/spending/plan`, `/spending/analytics`, `/spending/jars`; bảo toàn back/forward. Nếu chưa refactor route, state vẫn phải nhất quán và test được.
- Kế hoạch phải có state sub-tab: `wallets/budgets/recurring`.
- Khi mutation xảy ra (transaction, budget, wallet, jar, recurring), đồng bộ/invalidate dữ liệu tất cả panel bị ảnh hưởng thay vì chờ reload trang.

### Các điểm code hiện hữu cần xử lý

- `SpendingPage.jsx`: bỏ banner onboarding cố định hoặc render có điều kiện và dismissible; thay panel Home bằng `HomeView`.
- `Topbar.jsx`: thay English copy/nav và `en-US` date locale bằng Vietnamese copy/`vi-VN`.
- `AppShell.jsx` và CSS layout: loại bỏ `LeftRail` khỏi layout chính, không chỉ hide bằng CSS.
- `NumpadModal.jsx`: không được tạo `income/Salary` ngầm; thay bằng modal giao dịch chuẩn hoặc thiết kế lại cho một chức năng chuyên biệt, có nhãn nghiệp vụ chính xác.
- `AnalyticsView.jsx`: thêm month/range selection và insight/action; không khóa vô hình vào tháng hiện tại.
- `JarsView.jsx`: thay grid form dày và input/nút Nạp/Rút trực tiếp trên card bằng dialog có nhãn, preview và confirmation.
- `TransactionModal.jsx`: chuẩn hóa accessibility dialog, locale, input money, ví/tài khoản.

## 10. Trình tự triển khai

Thực hiện theo thứ tự sau. Sau mỗi phase chạy build/lint/tests hiện có và kiểm tra giao diện ở desktop + mobile.

### Phase 0 — Khảo sát và bảo vệ dữ liệu

1. Đọc routes, stores, services, models và test hiện có.
2. Lập mapping UI cũ → endpoint/store; xác nhận cách tính balance, budget, jar và transfer.
3. Chụp/ghi lại flow hiện tại để đối chiếu; không thay đổi API trước khi hiểu dữ liệu.

### Phase 1 — Foundation

1. Chuẩn hóa token light theme, font, spacing, surface, button, form, focus.
2. Refactor AppShell/Topbar theo navigation mới, bỏ left rail.
3. Thiết lập responsive container và page layout.
4. Chuẩn hoá tiếng Việt + `vi-VN` format helpers dùng chung.

### Phase 2 — Luồng quan trọng nhất

1. Implement modal thêm/sửa giao dịch chuẩn.
2. Sửa lỗi hard-code transaction type/category trong quick flow.
3. Thêm toast/confirmation/modal focus behavior.
4. Implement Home v2 với dữ liệu thật.

### Phase 3 — Kế hoạch và Hũ

1. Implement PlanView và ba sub-tab.
2. Refactor ví, ngân sách, recurring theo đặc tả.
3. Refactor Jar cards và luồng Nạp/Rút/Xóa.

### Phase 4 — Phân tích và hoàn thiện

1. Implement analysis range, insight, chart empty states.
2. Kiểm tra responsive 360px, 768px, 1024px, 1440px, 1920px.
3. Kiểm tra keyboard, contrast, reduced motion, loading/error/empty/destructive states.
4. Dọn CSS trùng lặp và inline style mới tạo.

## 11. Tiêu chí nghiệm thu (Definition of Done)

Agent chỉ báo hoàn thành khi tất cả điều sau đúng:

- [ ] Topbar có đủ `Trang chủ`, `Kế hoạch`, `Phân tích`, `Hũ chi tiêu`; active state và keyboard navigation hoạt động.
- [ ] Không còn persistent left rail trên desktop/mobile của app chính.
- [ ] Ở viewport 1440px, Home dùng không gian rộng tự nhiên và không có cụm card nhỏ bị dồn bên trái tạo vùng trống lớn.
- [ ] Hero Home thể hiện `Tiền có thể chi còn lại`, không đánh đồng với `Tổng số dư`.
- [ ] Home chỉ có một CTA giao dịch primary rõ ràng và mọi entry point hợp lệ mở cùng luồng.
- [ ] Thêm giao dịch chi/thu tạo đúng type, category, amount, date và wallet; không có default ngầm `income/Salary`.
- [ ] Kế hoạch có đủ sub-tab Ví & tài khoản / Ngân sách / Khoản định kỳ và các action cơ bản hoạt động với API thật.
- [ ] Hũ có create, nạp, rút, xoá an toàn; không có delete không confirm.
- [ ] Analytics chọn được thời gian và không hiển thị biểu đồ “rỗng” gây nhiễu khi dữ liệu ít.
- [ ] UI tiếng Việt nhất quán; tiền và ngày format `vi-VN`.
- [ ] Loading, empty, error, success, validation, confirm state được implement cho các flow trọng yếu.
- [ ] Modal keyboard accessible; Escape/focus management hoạt động.
- [ ] Test/build hiện có pass; thêm test hợp lý cho luồng transaction type và navigation nếu cấu trúc test hỗ trợ.
- [ ] Không có thay đổi không liên quan hoặc phá vỡ auth/API contracts.

## 12. Câu hỏi chỉ được hỏi khi thật sự bị chặn

Agent tự suy luận theo tài liệu này, không hỏi lại các quyết định UX đã chốt. Chỉ hỏi owner khi cần quyết định nghiệp vụ không thể suy ra, ví dụ:

1. Công thức chuẩn của `Tiền có thể chi` khi có ví bị loại trừ, hũ và nợ/thẻ tín dụng.
2. Nạp/rút hũ có phải tự động tạo transaction và chuyển tiền giữa các ví hay không.
3. Khoản định kỳ sau khi `Đã trả` phải tạo transaction loại nào, vào ví nào.

Khi bị chặn bởi một trong ba điểm trên, agent phải trình bày các phương án cùng tác động đến số dư trước khi code.
