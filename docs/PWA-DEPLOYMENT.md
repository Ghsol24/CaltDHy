# Cài CaltDHy như ứng dụng và chia sẻ bằng Render

CaltDHy là PWA: bạn bè mở một URL HTTPS, đăng ký bằng liên kết mời riêng, rồi cài
biểu tượng ứng dụng từ trình duyệt. Dữ liệu vẫn nằm trên máy chủ và MongoDB; cài
biểu tượng không tạo một bản sao dữ liệu trên điện thoại.

## Bước 1 — Bảo toàn Atlas hiện có

Dịch vụ Render hiện tại và ứng dụng trên máy trỏ đến database `CaltDHy` trên
cùng cụm MongoDB Atlas. **Giữ nguyên đích database**, nhưng thay `MONGODB_URI`
trên Render để dùng một DB user riêng, có mật khẩu mới. Render hiện báo
`bad auth`, vì vậy URI cũ không thể dùng để triển khai. Không tạo database
rỗng, không chạy seed/cleanup/migration trên production trong bước triển khai PWA. URI Atlas
có thể ở dạng `mongodb://…` nhiều host hoặc `mongodb+srv://…`; cả hai đều hợp lệ.
Cho dịch vụ công khai một DB user riêng với quyền `readWrite` chỉ trên
`CaltDHy`, thay vì dùng user quản trị Atlas chung cho máy cá nhân.

Trước khi đổi phiên bản, tạo một bản sao lưu có thể khôi phục và kiểm tra việc
khôi phục trên môi trường riêng. Nếu cluster là Atlas Free, nó không có backup
tự động; dùng `mongodump`/`mongorestore` theo [hướng dẫn MongoDB](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).
Giữ bản sao lưu ngoài repository, kiểm soát quyền truy cập và không đưa URI hay
dữ liệu tài chính vào chat, log hoặc ảnh chụp. Ghi lại số lượng collection và
bản ghi để đối chiếu sau khi chuyển phiên bản.

Nếu Atlas từ chối Render, xem **Render → Connect → Outbound** và cho phép đúng
dải IP outbound trong **Atlas → Network Access**. Chỉ thêm IP máy quản trị khi
cần cấp lời mời; không mở `0.0.0.0/0` để xử lý lỗi kết nối.

Đọc [hướng dẫn Atlas của Render](https://render.com/docs/connect-to-mongodb-atlas)
và [IP outbound của Render](https://render.com/docs/outbound-ip-addresses).

## Bước 2 — Nâng cấp dịch vụ Render hiện có

Đang có dịch vụ **CaltDHy** tại `https://caltdhy.onrender.com`. Nó dùng mã cũ
từ `giahuyz3sta-oss/CaltDHy` với Root Directory `server`, Build Command
`npm install`, Start Command `node server.js`. Bản React/Express hiện tại ở
`Ghsol24/CaltDHy` có cấu trúc khác. **Không dùng New → Blueprint ở bước này**:
Blueprint mẫu `render.yaml` dành cho lần cài mới và có thể tạo dịch vụ thứ hai.
Nâng cấp chính dịch vụ cũ sẽ giữ URL và biến môi trường hiện có. Render hỗ trợ
[đổi nguồn Git trên dịch vụ hiện hữu](https://render.com/changelog/change-your-services-backing-repo-or-image-in-the-render-dashboard).

1. Đưa mã đã kiểm tra lên nhánh GitHub dự định chạy. Mã mới chỉ nằm trên máy sẽ
   chưa xuất hiện trên Render. Kiểm tra bản sao lưu và ghi lại deploy thành công
   gần nhất để có đường [rollback](https://render.com/docs/rollbacks).
2. Trong Render, tắt Auto-Deploy nếu đang bật. Chuẩn bị cấu hình mục tiêu:

   | Mục | Giá trị mục tiêu |
   | --- | --- |
   | Source | Public Git Repository `https://github.com/Ghsol24/CaltDHy` (hoặc kết nối GitHub có quyền truy cập repository này) |
   | Branch | `main` hoặc nhánh phát hành đã kiểm tra |
   | Root Directory | để trống, chạy từ thư mục gốc repository |
   | Build Command | `npm ci --ignore-scripts --include=dev --prefix frontEnd-react && npm run build --prefix frontEnd-react && npm ci --ignore-scripts --omit=dev --prefix backEnd/server` |
   | Start Command | `node backEnd/server/server.js` |
   | Health Check Path | `/api/health` |
   | Node | `.node-version` chọn Node 24; Render tự đặt `NODE_ENV=production`; trên Render, ứng dụng mặc định lắng nghe `0.0.0.0:10000` |
   | Phiên và đăng ký | Trên Render, mặc định đăng ký bằng lời mời, cookie Secure khi `CLIENT_URL` là HTTPS và tin một proxy; có thể đặt rõ `COOKIE_SECURE=true`, `REGISTRATION_MODE=invite`, `TRUST_PROXY_HOPS=1` |
   | URL | `CLIENT_URL=https://caltdhy.onrender.com` |
   | Dữ liệu | `MONGODB_URI` tới **cùng database Atlas**, dùng DB user riêng chỉ có quyền `readWrite` trên `CaltDHy` |

   Nếu dịch vụ hiện có chỉ có `CLIENT_URL`, `JWT_SECRET` và `MONGODB_URI`, ba biến
   đó đủ để bản mới khởi động trên Render; các giá trị mặc định ở trên áp dụng
   khi Render cung cấp `RENDER=true`. Vẫn kiểm tra từng giá trị sau khi deploy.
3. Trong **Atlas → Security → Database Access/Database Users → Add New Database
   User**, chọn **Password**, đặt tên `caltdhy_render`, tự tạo và lưu mật khẩu
   ngẫu nhiên, chọn role `readWrite` cho đúng database `CaltDHy`, rồi bật
   **Restrict Access to Specific Clusters** và chọn `Cluster0`. Người sở hữu
   Atlas tự hoàn tất bước tạo user và nhập mật khẩu. Sau đó lấy connection
   string từ **Cluster0 → Connect → Drivers**, điền mật khẩu vào đúng chỗ trên
   máy của mình; nếu mật khẩu có ký tự đặc biệt, URL-encode phần mật khẩu.
   URI cần giữ database `/CaltDHy` và phương thức xác thực phù hợp với URI
   Atlas. Cập nhật URI mới trong **Render → Environment → `MONGODB_URI`**.
   Nếu xoay mật khẩu user quản trị cũ, cập nhật cả `backEnd/server/.env` trên
   máy. Cũng thay
   `JWT_SECRET` mặc định/cũ bằng khóa ngẫu nhiên dài ít nhất 32 byte trong
   Render. Không gửi mật khẩu, URI hay khóa qua chat hoặc đưa vào repository.
   Khi chuẩn bị nhiều biến cùng lúc, Render cho phép chọn **Save only** để lưu
   cấu hình mà chưa triển khai; các giá trị mới chỉ có hiệu lực ở lần deploy kế
   tiếp ([hướng dẫn Render](https://render.com/docs/configure-environment-variables)).
   Đổi khóa phiên làm các phiên đăng nhập cũ hết hiệu lực, nhưng không xóa tài
   khoản hay giao dịch. Bản mới từ chối khởi động nếu khóa còn là giá trị mặc
   định cũ.
4. Lưu cấu hình và chuyển Source sau khi toàn bộ giá trị đã đúng. Render sẽ
   triển khai từ nguồn mới; đợi `/api/health` trả `status: OK` và
   `db: connected`. Nếu build/start thất bại, Render thông thường giữ bản đã
   chạy gần nhất; vẫn phải kiểm tra Deploys, Logs và URL thực tế. Rollback code không tự khôi phục dữ
   liệu hoặc sửa credential sai.
5. Đăng nhập bằng tài khoản đã có, so số lượng và tổng tiền của các ví/giao
   dịch với bản trước, kiểm tra link mời và PWA, rồi mới gửi URL cho bạn bè.
   Kiểm tra giới hạn đăng nhập từ hai mạng: `TRUST_PROXY_HOPS=1` chỉ phù hợp nếu
   có đúng một proxy đáng tin trước ứng dụng. Chỉ chạy một instance khi rate
   limit còn nằm trong bộ nhớ tiến trình.

Nếu cần **dịch vụ mới hoàn toàn**, `render.yaml` là mẫu một Web Service phục vụ
frontend và `/api` cùng origin qua HTTPS; không dùng mẫu đó để cập nhật dịch vụ
hiện tại. Dịch vụ mới cần database/secret riêng hoặc kế hoạch chuyển dữ liệu
được kiểm chứng. Tạo song song hai dịch vụ ghi vào cùng database không phải là
quy trình nâng cấp an toàn.

Render Free [ngủ sau 15 phút không có truy cập và có thể mất khoảng một phút để
khởi động lại](https://render.com/docs/free). Gói này phù hợp chạy thử, không
phù hợp khi cần luôn sẵn sàng hoặc dữ liệu thật quan trọng. Render Free cũng
**chặn SMTP cổng 25, 465 và 587**, nên Gmail hiện có sẽ không gửi được email
xác minh/đặt lại mật khẩu. API nay báo chức năng email chưa sẵn sàng khi chưa
cấu hình. Trước khi mời bạn bè dùng lâu dài, chuyển sang gói cho phép SMTP và
đặt `GMAIL_USER`, `GMAIL_PASS` trong Render, hoặc triển khai nhà cung cấp email
qua HTTPS riêng; sau đó thử gửi và đặt lại mật khẩu thực tế. Chi phí gói trả phí
cần được bạn chọn trong Render.

## Bước 3 — Tạo và gửi lời mời

Production mặc định `REGISTRATION_MODE=invite`; chỉ người có token hợp lệ mới
tạo được tài khoản. Token ngẫu nhiên được lưu dưới dạng SHA-256, gắn với email,
hết hạn mặc định sau 7 ngày, và được đánh dấu đã dùng trong cùng transaction tạo
tài khoản. Trang `/signup` không có token sẽ giải thích rằng cần lời mời.

Trên **máy quản trị tin cậy** có quyền kết nối Atlas, cấp `MONGODB_URI` và
`CLIENT_URL` của dịch vụ Render qua biến môi trường riêng hoặc file
`backEnd/server/.env` bị Git bỏ qua, rồi chạy:

```sh
node backEnd/server/scripts/create-invitation.js ban@example.com
```

Thêm số ngày nếu cần: `node backEnd/server/scripts/create-invitation.js
ban@example.com 3` (chỉ cho phép 1–30 ngày). Script in **một URL có token**;
gửi URL đó riêng cho đúng người nhận. Ai có URL đều có thể dùng nó để tạo tài
khoản cho email đó trước khi nó hết hạn. Không đăng URL lên nhóm công khai,
không đặt vào log hay tài liệu. Render Free không có shell quản trị; script này
chạy từ máy quản trị, không phải từ trình duyệt người dùng.

Nếu người nhận không mở được lời mời, kiểm tra URL còn hạn, email trong URL là
email họ đăng ký, và ứng dụng đang kết nối được Atlas. Khi cần thu hồi lời mời
chưa dùng, xóa tài liệu tương ứng trong collection `invitations` ở Atlas trước
khi người nhận đăng ký; không xóa tài khoản hoặc dữ liệu khác.

## Bước 4 — Kiểm tra trước khi chia sẻ

1. Mở URL HTTPS; `/api/health` trả 200 và `db: connected`.
2. Mở `/manifest.json`, `/app-icon-192.png`, `/app-icon-512.png`, `/sw.js` ở
   cùng origin; trong Chrome DevTools → Application kiểm tra biểu tượng và
   service worker.
3. Tạo một lời mời thử, đăng ký đúng email, rồi thử lại URL đó để xác nhận nó
   không thể dùng lần hai. Mở `/signup` không có lời mời và xác nhận không có form.
4. Dùng hai tài khoản thử để xác nhận dữ liệu từng người tách biệt. Thử đăng
   xuất, đăng nhập và mở trực tiếp một trang sâu.
5. Cài ứng dụng trên iPhone/Android hoặc máy tính. PWA chỉ cache tài nguyên
   giao diện; `/api` và dữ liệu tài chính vẫn cần mạng. Bản giao diện mới hiện
   lời nhắc để người dùng chủ động cập nhật sau khi lưu biểu mẫu đang nhập.
6. Thử sao lưu, khôi phục, email đặt lại mật khẩu và kiểm tra hạn mức truy cập
   trước khi nhập dữ liệu thật.

## Bạn bè cài như thế nào?

- iPhone: Safari → Share → **Add to Home Screen** → **Open as Web App**.
- Android: Chrome → **Install app** hoặc **Add to Home Screen**.
- Máy tính: menu cài web app của Chrome/Edge; Safari macOS hỗ trợ **Add to Dock**
  trên phiên bản tương thích.

Trình duyệt và hệ điều hành quyết định cách hiện nút cài. Người nhận vẫn dùng
được URL như website trước khi cài. Xem thêm [hướng dẫn production](PRODUCTION-RUNBOOK.md).
