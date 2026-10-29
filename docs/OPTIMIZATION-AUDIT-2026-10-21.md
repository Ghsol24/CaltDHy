# Kiểm chứng đánh giá và kế hoạch tối ưu CaltDHy

Ngày kiểm tra: 21/10/2026. Trạng thái: đánh giá và đề xuất, chưa triển khai tối ưu.

## Phạm vi và mức độ chắc chắn

- Đã đọc mã nguồn, luồng tải dữ liệu, mô hình tiền, cấu hình CI, bộ kiểm thử và cấu hình triển khai.
- Đánh giá trên working tree hiện tại, nền `main` tại `2e94f61`, có thay đổi chưa commit về ví, số dư âm và lịch sử. Không hoàn nguyên hoặc sửa các thay đổi đó.
- Đã chạy lint và build frontend vào thư mục tạm; chạy logic kiểm tra UX budget hiện có trên bản build tạm. Không thay đổi `dist` của workspace.
- Chưa chạy lại toàn bộ backend/E2E, chưa benchmark API, chưa kiểm tra gói dịch vụ thực tế trong Render Dashboard hoặc đo cold start production. Sự tồn tại của test không đồng nghĩa test hiện tại đều pass.
- Số dòng, số hook và số style là chỉ dấu về khả năng bảo trì. Chúng không tự chứng minh tốc độ render hoặc thời gian phản hồi thực tế.

## 1. Backend: nhận xét có cơ sở, cách sửa cần thêm điều kiện

### GET đang tham gia khóa ghi chung

`backEnd/server/utils/financialRequest.js:75` phân biệt GET/HEAD để bỏ yêu cầu Idempotency-Key, nhưng vẫn thực hiện bootstrap MoneyLock, mở transaction và cập nhật token của MoneyLock. Tất cả request tài chính cùng user tranh chấp cùng document khóa; người dùng khác có document khóa riêng. Chính xác hơn là có thể chờ, gặp write conflict và chạy lại transaction, không phải một hàng đợi FIFO được đảm bảo.

`frontEnd-react/src/pages/SpendingPage.jsx:39` gọi bốn hành động tải dữ liệu. Các hành động này triển khai thành sáu GET: giao dịch, ví, ngân sách, danh mục, hũ và khoản định kỳ. Cả sáu đi qua wrapper trên.

Không nên thêm một nhánh bỏ transaction cho mọi GET một cách máy móc:

- `backEnd/server/routes/wallets.js:37` có `ensureDefaultWallet`; GET danh sách ví gọi hàm này và có thể tạo ví. Phải tách việc khởi tạo thành thao tác ghi có chống trùng, đồng thời hỗ trợ tài khoản cũ/chưa có ví.
- GET tính số dư đọc nhiều collection. Cần giữ ảnh chụp dữ liệu nhất quán nếu các truy vấn có thể gặp thao tác ghi ở giữa. Bỏ ghi MoneyLock không bắt buộc phải bỏ read-only snapshot transaction.
- Mỗi request có snapshot riêng cũng chưa bảo đảm sáu response thuộc cùng một thời điểm. Nếu UI cần tổng quan nhất quán tuyệt đối, thiết kế endpoint tổng quan chung hoặc cơ chế phiên bản dữ liệu.

MongoDB mô tả snapshot là dữ liệu tại một thời điểm; Mongoose có cơ chế retry transient transaction errors. Không chạy các truy vấn bằng Promise.all bên trong cùng transaction/session. Nguồn: [MongoDB snapshot](https://www.mongodb.com/docs/manual/reference/read-concern-snapshot/), [Mongoose 8 transactions](https://mongoosejs.com/docs/8.x/docs/transactions.html).

### Kiểm tra số dư tải toàn bộ lịch sử

`financialRequest.js:50` gọi `getAllWalletBalances` sau thao tác ghi thành công, trước commit. `backEnd/server/utils/walletBalance.js:8` tải toàn bộ ví và toàn bộ giao dịch của user, cộng bằng BigInt trong Node. Thao tác bị từ chối hoặc được replay từ receipt không nhất thiết chạy lại bước này. Một số route tính số dư trước thao tác còn làm cùng phép tính thêm một lần.

Aggregation là bước đầu phù hợp, nhưng phải giữ nguyên:

- Số dư đầu kỳ, thu, chi, phí, hai đầu chuyển ví.
- Chuyển ví–hũ có thể chỉ có một đầu là ví; đây vẫn là transfer, không biến thành thu/chi.
- Kiểm tra tham chiếu ví bị thiếu và tiền không hợp lệ; không âm thầm bỏ qua dữ liệu lỗi.
- Độ chính xác số nguyên và giới hạn tổng tài sản. Bản hiện tại dùng BigInt; `$sum` trên double không tự tương đương. Cần xác định kiểu cộng chính xác, thí dụ Decimal128 có kiểm tra giới hạn, và đối chiếu với bộ tính BigInt.
- Quy tắc hiện tại: ví hoạt động được ghi số dư âm/vượt hạn mức kèm cảnh báo; hũ không âm và ví đã đóng phải giữ số dư 0. Không khôi phục quy tắc cấm âm cũ trong lúc refactor.
- Cùng transaction cho ghi ledger, audit và receipt; giữ idempotency và rollback.

Aggregation giảm dữ liệu truyền sang Node và bộ nhớ ứng dụng, nhưng vẫn phải đọc các giao dịch phù hợp trong database. Không coi đây là cách biến tính số dư thành chi phí cố định. Chỉ cân nhắc số dư lưu sẵn sau khi đo cho thấy aggregation chưa đáp ứng. Nguồn về kiểu số và việc `$sum` bỏ qua giá trị không phải số: [MongoDB $sum](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sum/).

### Phân trang chưa bắt buộc và frontend phụ thuộc dữ liệu đầy đủ

`backEnd/server/routes/spending.js:570` chỉ phân trang khi có cả page và limit hợp lệ; nhánh còn lại trả tất cả. `frontEnd-react/src/stores/useTransactionStore.js:137` hiện gọi API không có tham số phân trang.

Các chỉ số tổng quan và `frontEnd-react/src/stores/useWalletStore.js:40` đang tính từ mảng giao dịch ở client. Chặn API ở 50/100 dòng ngay sẽ làm sai số dư, thu chi, cảnh báo, biểu đồ và lịch sử theo ví. Phải tách dữ liệu tổng hợp khỏi danh sách phân trang trước.

Có thêm lỗi cụ thể ở nhánh phân trang: query giới hạn tối đa 500 bản ghi, nhưng skip và metadata vẫn dùng limit gốc. Với limit=1000, trang 2 bỏ qua 1000 dòng dù trang 1 chỉ trả 500. Chuẩn hóa limit một lần rồi dùng thống nhất.

Working tree hiện còn trả toàn bộ `WalletActivity` kèm GET ví (`wallets.js:68`). Nên tách lịch sử ví thành endpoint phân trang. Export là nhu cầu riêng: không giới hạn âm thầm dữ liệu sao lưu theo trang UI.

## 2. Frontend: file lớn đúng, không suy ra chậm chỉ từ số dòng

Đếm văn bản trong `frontEnd-react/src`, gồm file hiện có chưa commit, không gồm dependencies hoặc dist:

| Chỉ số | Kết quả |
|---|---:|
| JarsView.jsx | 2.051 dòng |
| WalletsTab.jsx | 1.762 dòng |
| AnalyticsView.jsx | 1.701 dòng |
| AccountModal.jsx | 1.197 dòng |
| JS/JSX/MJS/TS/TSX | 27.029 dòng |
| Lần gọi có dạng `useState(` | 228 |
| Tất cả lần xuất hiện từ `useState`, gồm import | 267 |
| Thuộc tính JSX có dạng `style={...}` | 340 |

Con số 263/335 trong ảnh không khớp chính xác bản hiện tại; riêng số useState cần phân biệt lần xuất hiện từ khóa với lần gọi hook. Nên tách theo trách nhiệm và quyền sở hữu state, không đặt mục tiêu giảm số hook bằng mọi giá.

App đã lazy-load nhiều trang, bao gồm Analytics và Jars (`pages/SpendingPage.jsx:15`). Tách một component thành nhiều file mà vẫn import tĩnh không tự giảm dung lượng tải. PlanView hiện import tĩnh tất cả tab; đây là một ứng viên cần đo trước khi tách tải theo tab.

## 3. CSS: số liệu đúng gần như hoàn toàn

- CSS trong src: 35.462 dòng; `components.css`: 12.016 dòng; `!important`: 611 lần.
- `main.jsx:5` import phần lớn CSS toàn cục, kể cả giao diện cho các tính năng chưa mở.
- Có nhiều khối theme/override và file `spa-overrides.css` được yêu cầu xếp cuối; đó là bằng chứng cụ thể về sự phụ thuộc thứ tự cascade. Không thể kết luận cả 611 `!important` đều sai hoặc mọi selector lặp đều thừa.
- Đúng hướng: làm từng tính năng, xác định CSS thực sự dùng và các trường hợp theme/mobile trước khi bỏ hoặc chuyển rule. Không xóa `!important` hàng loạt, không dùng kết quả coverage của một màn hình để xóa CSS của trạng thái khác.

Build hiện tại cho số liệu sau; dung lượng gzip là phép nén tại máy, không phải lưu lượng thực tế đo trên production:

| Tài nguyên tham chiếu trực tiếp trong HTML | Chưa nén | gzip tại máy |
|---|---:|---:|
| JS entry + modulepreload | 363.556 byte, khoảng 355,0 KiB | 112.487 byte, khoảng 109,9 KiB |
| CSS ban đầu | 580.476 byte, khoảng 566,9 KiB | 90.987 byte, khoảng 88,9 KiB |

Build thành công, nhưng logic `tests/ux-performance-budget.cjs` thất bại vì JS vượt 350 KiB, chênh 5.156 byte. CSS vẫn dưới budget 600 KiB. Đây là kết quả working tree tại máy, chưa phải kết luận một lần chạy GitHub Actions đang thất bại.

PWA build còn có danh sách precache 49 tài nguyên, khoảng 1.848 KiB. Các chunk lazy có thể được tải nền khi service worker cài đặt; cần đo lượt truy cập mới và lượt có cache riêng. Không nhầm số liệu entry với tổng tải mạng.

## 4. CI và vệ sinh repo: đúng một phần

- **Đúng:** frontend có script oxlint nhưng `.github/workflows/test.yml` chưa gọi. Lint chạy tại máy trả exit code 0 với 3 warning: re-export ở `categoryIcons.jsx`, dependency effect ở `SpendingRouteSync.jsx`, dependency memo ở `WalletsTab.jsx`.
- **Sai:** frontend chỉ có test tiện ích, chưa có test luồng giao diện. Repo có `tests/browser-security.cjs`, `transaction-period-browser.cjs`, `cash-flow-browser.cjs`, `mobile-ux-browser.cjs`; workflow browser-security cài Chromium và chạy `npm run test:e2e`. Ngoài ra đã có test hook tùy chọn dòng tiền.
- **Đúng nhưng ưu tiên thấp:** package backend còn tên `projectcanhan-server` và mô tả cũ. Đây là vấn đề đặt tên, không phải nút thắt runtime.
- **Không phải file chết:** `legacyTranslations.js` được dùng bởi Analytics/Recurring và được LocalizationObserver tải khi cần. Nó import `legacyAdditionalTranslations.js`. Chỉ bỏ sau khi chuyển hết UI liên quan sang translation keys và kiểm tra các ngôn ngữ.
- **Không mặc định là rác:** `CaltDHy.app` được Git theo dõi, có icon 2.033.377 byte, nằm trong allowlist phát hành và có `tests/launcher-safety.cjs`. Nó phục vụ chạy ứng dụng trên macOS; không được gửi tới trình duyệt qua frontend dist. Nếu tách sang tài sản phát hành riêng, phải cập nhật tài liệu và kiểm thử đóng gói.
- Root test script liệt kê thủ công từng file test frontend; cần kiểm tra các test mới như wallet-opening-input/wallet-balance-preview đã được đưa vào CI khi hoàn thiện thay đổi đang làm.

## 5. Render: cold start đúng với gói Free, chưa xác nhận gói live

Render ghi Free web service ngủ sau 15 phút không có inbound traffic và mất khoảng một phút để khởi động khi có request. `render.yaml` có `plan: free`, nhưng chính file này ghi rõ chỉ là template cho cài đặt mới. Không dùng nó để kết luận chắc chắn service đang chạy dùng gói Free. Nguồn: [Render Free](https://render.com/docs/free).

`backEnd/server/server.js:197` phục vụ cả frontend từ Express. Với lượt truy cập mới chưa có cache, server chưa dậy thì HTML/JS landing cũng chưa tải được; chỉ thêm dòng chờ trong React không giải quyết khoảng trắng/chờ đầu tiên.

Lựa chọn triển khai sau khi xác nhận gói live và đo lượt truy cập mới:

- Nếu ưu tiên demo/CV không phát sinh chi phí: landing tĩnh độc lập, có nội dung giới thiệu, ảnh/video và nút mở ứng dụng; API có thể vẫn cold start. Không cần tách cả SPA ngay.
- Nếu cần mở trực tiếp ứng dụng ổn định: cân nhắc instance trả phí không bị idle spin-down. Đây là quyết định chi phí, chưa được thực hiện.
- Nếu tách cả frontend lên static hosting: cần thiết kế đường dẫn API, cookie, CSRF, CORS, CSP và callback xác thực; bảo toàn phiên đăng nhập.
- Ping định kỳ chỉ là biện pháp tạm, không biến gói Free thành dịch vụ có cam kết luôn sẵn sàng; vẫn chịu giới hạn số giờ dùng chung và khả năng restart. Không chọn làm giải pháp chính.

Render hỗ trợ static site qua CDN: [Render Static Sites](https://render.com/docs/static-sites).

## Kế hoạch thực hiện theo thứ tự

### Đợt 0 — Chốt baseline và khôi phục kiểm tra chất lượng

1. Chốt phạm vi thay đổi chưa commit trước khi bắt đầu refactor; không gộp sửa nghiệp vụ tiền với tối ưu sâu.
2. Xử lý chỗ làm JS tải đầu vượt 350 KiB bằng phân tích dependency graph. Giữ nguyên ngưỡng hiện có, không tăng ngưỡng chỉ để test pass.
3. Thêm lint vào CI; xử lý ba warning theo nguyên nhân. Sau khi sạch mới bật chặn warning nếu phù hợp.
4. Kiểm tra cách phát hiện test mới để các test frontend vừa thêm không bị bỏ qua. Chạy đầy đủ test hiện có để có baseline rõ ràng.
5. Đo API với dữ liệu giả 1.000 / 10.000 / 50.000 giao dịch trên DB riêng: p50/p95, query count, retry/write conflict, bộ nhớ Node và byte response. Đo cùng user tải đồng thời sáu GET, nhiều user và GET chạy đồng thời với ghi.
6. Đo tải lạnh/ấm frontend và PWA, CPU khi tương tác và kích thước tài nguyên theo trang. Xác nhận gói Render thực tế riêng.

Tiêu chí xong: lint đạt chính sách đã chọn, JS <=350 KiB và CSS <=600 KiB, baseline test và hiệu năng có kết quả lưu lại. Các mục đo hiệu năng ở đây là công việc kế hoạch, chưa được làm trong lượt audit này.

### Đợt 1 — Tách đọc khỏi khóa ghi

1. Phân loại GET thuần đọc, GET nhiều truy vấn cần snapshot và GET có khởi tạo dữ liệu.
2. Tách khởi tạo ví mặc định thành luồng ghi idempotent/chống trùng; giữ tính tương thích tài khoản cũ.
3. GET thuần đọc không ghi MoneyLock/receipt. GET tổng hợp giữ snapshot khi cần. Thao tác ghi giữ serialization theo user, receipt và transaction.
4. Giữ validation, ownership, định dạng response và xử lý lỗi hiện có; không chỉ gọi handler trực tiếp rồi làm mất middleware cần thiết.

Tiêu chí xong: các GET đã chuyển không tạo write lock; tải đồng thời không tạo ví trùng; snapshot số dư không bị trộn trước/sau một giao dịch; money-integrity/security tests qua. So sánh p95 với baseline, không hứa phần trăm cải thiện trước khi đo.

### Đợt 2 — Giảm chi phí tính số dư

1. Viết một bộ tính aggregation có match theo user, biểu diễn đóng góp từng đầu ví, số dư đầu kỳ và kiểu số chính xác. Tính toàn bộ số dư một lần trong mỗi luồng khi có thể.
2. Đối chiếu bộ tính mới với BigInt cũ trên fixture và dữ liệu sinh ngẫu nhiên, cả trường hợp số trung gian rất lớn nhưng số dư cuối nhỏ.
3. Dùng explain trên truy vấn thực tế để quyết định index. Repo đã có index user/date và user/wallet; xem xét toWalletId và thứ tự sort thay vì thêm trùng hoặc thêm mù quáng.
4. Kiểm tra không mất khả năng phát hiện dữ liệu lỗi/tham chiếu ví thiếu và giữ đầy đủ invariant tài chính.

Tiêu chí xong: kết quả số dư/tổng tài sản chính xác như baseline, rollback/idempotency và nghiệp vụ số dư âm hiện tại giữ nguyên, bộ nhớ Node không còn chứa mảng mọi giao dịch cho phép tính này. Nếu database vẫn là nút thắt, mới lập thiết kế số dư lưu sẵn với backfill, đối soát và cập nhật delta trong cùng transaction.

### Đợt 3 — API tổng hợp và phân trang đồng bộ frontend

1. Cung cấp số dư và số liệu tổng hợp theo bộ lọc/thời gian từ backend; bảo toàn cách tính thu/chi, phí và loại trừ chuyển nội bộ của từng chỉ số hiện có.
2. Chuyển Home, Analytics, Wallets và các cảnh báo sang dùng số liệu tổng hợp; danh sách giao dịch chỉ phục vụ hiển thị chi tiết. Không tải vòng qua tất cả các trang để tiếp tục tính ở client.
3. Áp dụng trang mặc định và limit tối đa nhất quán. Ưu tiên cursor có thứ tự ổn định `(date, createdAt, _id)` nếu lịch sử lớn; nếu giữ page/offset giai đoạn đầu, sửa clamp trước skip/metadata và quy định rõ hành vi khi có ghi xen kẽ.
4. Phân trang lịch sử ví; tải theo nhu cầu. Giữ export đầy đủ bằng luồng riêng, cân nhắc streaming khi kích thước lớn.
5. Triển khai theo bước tương thích: API tổng hợp mới → frontend mới → giới hạn endpoint cũ sau khi xử lý client/PWA cũ. Cần cơ chế cập nhật bắt buộc hoặc version API trước khi đổi hợp đồng gây thiếu dữ liệu cho client cũ.

Tiêu chí xong: dữ liệu 50.000 giao dịch không bị tải hết khi mở app; tổng số dư/thống kê không đổi khi chuyển trang; không sót/trùng do limit sai; xuất dữ liệu vẫn đầy đủ; đăng xuất/đổi tài khoản không nhận nhầm response cũ.

### Đợt 4 — Tách giao diện và CSS theo tính năng

1. Bắt đầu với JarsView: tách bộ lọc/danh sách, biểu đồ, cụm dialog và hook xử lý state theo trách nhiệm. Sau đó WalletsTab, AnalyticsView và AccountModal.
2. Đo render trước khi thêm memo, thay state hoặc đổi subscription. Giữ selector hẹp khi có lợi; không coi giảm số useState là mục tiêu.
3. Tách CSS của tính năng khỏi entry toàn cục khi không dùng chung; kiểm tra cascade, specificity và CSS tải muộn. Mỗi đợt chỉ chuyển một nhóm giao diện.
4. Thay style tĩnh lặp lại bằng class; giữ style động như màu, kích thước/tỷ lệ biểu đồ khi phù hợp.
5. Đối chiếu giao diện desktop/mobile, các theme, ngôn ngữ, modal, focus/Escape và scroll. Nếu muốn thay bố cục, trình bày thiết kế riêng trước khi triển khai.
6. Đánh giá việc preload/precache để giảm tải đầu mà vẫn giữ đúng trải nghiệm PWA; không hy sinh cập nhật và offline behavior một cách vô tình.

Tiêu chí xong: các luồng browser hiện có qua; không mất tiêu đề/nút thao tác hoặc tràn ngang mobile; entry CSS và tải mạng giảm có đo đạc; không chỉ chuyển cùng lượng CSS sang nhiều file rồi coi là tối ưu.

### Đợt 5 — Hoàn thiện bản demo và vệ sinh

1. Nếu mục tiêu gần là gửi CV và live đang Free, ưu tiên nhánh landing tĩnh/cold start ngay sau đợt 0, có thể làm trước các refactor lớn.
2. Đổi tên/mô tả package và lockfile nhất quán.
3. Lập danh sách nơi dùng legacy translation, chuyển từng khu vực rồi mới bỏ cơ chế dịch cũ.
4. Giữ launcher macOS khi còn là sản phẩm được hỗ trợ; chỉ tách khỏi repo nếu đã có phương án phát hành thay thế và cập nhật tests/docs.

## Kiểm chứng trước khi phát hành tối ưu

- Mỗi đợt là thay đổi nhỏ có thể quay lui; không đồng thời bỏ lock, đổi nguồn số dư, đổi pagination và viết lại UI trong một bản lớn.
- Kiểm thử tiền: thu/chi có phí, chuyển hai ví, nạp/rút hũ hoàn tác, recurring thanh toán một lần, sửa/xóa/chuyển ví của giao dịch, ví âm, ví đóng, số sát giới hạn, ownership, retry và rollback.
- Kiểm thử đọc: khởi tạo ví đồng thời, đọc trong lúc ghi, dữ liệu lớn, phân trang và tổng hợp độc lập.
- Kiểm thử giao diện: luồng quan trọng, trạng thái lỗi/chờ, mobile, theme/ngôn ngữ, đổi tài khoản và PWA cũ/mới.
- Khi có bản được phép phát hành: xác nhận SHA, CI hoàn tất thành công, deployment tương ứng, health/database, asset build và kiểm tra trình duyệt. Audit hiện tại không xác nhận các điều kiện phát hành này.
