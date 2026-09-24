# CaltDHy — vận hành và phát hành

## Điều kiện triển khai

- Node.js 24 trở lên; MongoDB replica set hoặc sharded cluster có transaction. MongoDB standalone bị từ chối. Test dùng database tạm độc lập, không dùng database thật.
- Triển khai web cùng origin cho giao diện và `/api`, qua HTTPS. Cấp cấu hình riêng theo `backEnd/server/.env.example`; bật `COOKIE_SECURE=true` cho web HTTPS. Không đưa `.env` thật vào mã nguồn, CI artifact hoặc frontend.
- Khóa `JWT_SECRET` hiện dùng cho HMAC phiên opaque và CSRF, tên biến được giữ để tương thích cấu hình. Phiên có cookie HttpOnly, SameSite Strict; bearer JWT cũ không còn hợp lệ. Đổi khóa sẽ vô hiệu hóa các phiên cũ. Mật khẩu mới cần ít nhất 12 ký tự, tối đa 72 byte UTF-8.
- Rate limit hiện lưu trong từng tiến trình. Backend không tin `X-Forwarded-For`; nếu đặt sau reverse proxy, bộ đếm sẽ thấy IP của proxy. Trước khi triển khai nhiều instance, cần shared rate-limit store và cấu hình chính xác proxy tin cậy cùng giới hạn tại gateway. Không bật `trust proxy=true` vô điều kiện.
- Launcher chỉ phục vụ ứng dụng HTTP trên máy cục bộ. Cookie Secure phải tắt cho bản loopback này. `CLIENT_URL` HTTPS hoặc `HOST` ngoài loopback luôn bắt buộc Secure, kể cả khi `COOKIE_SECURE=false`; phải tách cấu hình web HTTPS và launcher HTTP. Không dùng cấu hình launcher làm cấu hình website công khai.

## Kiểm tra dữ liệu trước nâng cấp

Sao lưu và thử khôi phục trên môi trường cô lập trước khi thay phiên bản. Đối soát tổng tiền của từng tài khoản/ví/hũ và giao dịch liên kết. Tiền hiện là số nguyên VND trong miền số nguyên an toàn của JavaScript; không tự làm tròn hay chuyển đổi dữ liệu cũ có phần thập phân. Ví tiền mặt âm, hũ âm, số quá giới hạn, liên kết thiếu hoặc sai chủ sở hữu cần được điều tra và điều chỉnh có dấu vết trước khi mở ghi.

Backend tạo collection/index được khai báo khi khởi động. Unique index bảo vệ ví mặc định đang hoạt động, kỳ thanh toán định kỳ và biên nhận idempotency. Dữ liệu trùng có thể làm tạo index thất bại và backend dừng khởi động. Phải đối soát, xử lý dữ liệu trùng có kiểm soát rồi mới khởi động lại; không xóa index hay bỏ transaction để vượt qua lỗi.

Mọi thay đổi tiền của một người dùng được tuần tự hóa trong transaction; phản hồi thành công chỉ phát ra sau commit. Client gửi UUID trong `Idempotency-Key`; API giữ biên nhận lâu dài. Không tự xóa biên nhận nếu vẫn cần bảo đảm chống lặp cho khóa cũ. Client giữ khóa retry trong bộ nhớ trang; sau lỗi mạng và reload, cần kiểm tra lịch sử trước khi tạo lại thao tác, vì một thao tác mới với khóa mới không được coi là retry của thao tác cũ.

Giao diện cộng tiền bằng số nguyên chính xác trước khi chuyển sang số cho biểu đồ. Nếu tổng doanh số/tài sản vượt miền hiển thị an toàn, giao diện báo giới hạn thay vì hiển thị kết quả đã làm tròn. Số dư từng ví còn hợp lệ không đồng nghĩa tổng doanh số lịch sử còn nằm trong miền đó. Cần thu hẹp phạm vi báo cáo hoặc mở rộng pipeline hiển thị số nguyên trước khi dùng tập dữ liệu quá lớn; không sửa database chỉ để che cảnh báo.

## Cài đặt và kiểm tra trên máy phát triển

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix backEnd/server
npm ci --ignore-scripts --prefix frontEnd-react
npx --no-install playwright install chromium
npm run test:all
```

Test backend và browser tạo MongoDB replica set tạm. Lần đầu có thể tải binary MongoDB; đặt `MONGOMS_VERSION=8.2.6` để dùng cùng phiên bản CI. Máy có binary tương thích có thể cấp `MONGOMS_SYSTEM_BINARY` và `MONGOMS_RUNTIME_DOWNLOAD=false`. Browser test hỗ trợ `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; trên macOS có thể dùng Google Chrome đã cài sẵn.

`npm run dev` chạy hai tiến trình con do runner sở hữu, backend development tại 127.0.0.1:24127 và Vite tại 127.0.0.1:5173. Runner không cài dependency, không dọn cổng, không tự mở trình duyệt; nếu một dịch vụ dừng thì dịch vụ còn lại được dừng theo. Cấp URI database phát triển và khóa riêng trước khi chạy.

Các file `tests/test-category-*.js`, `tests/test-archive-wallet.js` và `tests/run-api-contract.js` là test mô phỏng cũ, không phải bằng chứng bảo mật cho API hiện tại. Cổng kiểm tra hiện dùng test thật trong `backEnd/server/tests/*.test.js`, `tests/release-guards.cjs` và `tests/browser-security.cjs`. `tests/run-e2e.js` gọi lại cổng kiểm tra hiện tại.

## Phát hành sạch

```sh
npm run test:all
npm run prepare:release
npm run package:source
```

`prepare:release` sao chép nguồn theo allowlist sang thư mục mới trong `release/`, cài dependency backend từ lockfile, build frontend trong môi trường đã lọc bỏ bí mật, không chạy lifecycle script của dependency, quét bundle và xóa dependency build frontend. Chỉ build script đã có trong dự án được chạy. Không dùng lại `dist` có sẵn hay cấu hình `.env` của workspace. Cấp bí mật riêng cho thư mục runtime sau khi hoàn tất kiểm tra; chạy `npm start` tại thư mục đó hoặc launcher macOS đặt cạnh project. Runtime Node phải được cung cấp riêng hoặc đặt đúng cấu trúc bundle mà launcher hỗ trợ.

`package:source` chỉ đóng **mã nguồn sạch** và manifest SHA-256, kiểm tra danh sách ZIP rồi xuất checksum cạnh ZIP. Gói này không chứa `node_modules`, `dist`, `.env` thật, dump database, khóa riêng hoặc archive cũ. Nó không phải ứng dụng macOS độc lập đã ký/notarize; người nhận cần cài dependency và build có kiểm soát. Quét tĩnh chỉ nhận diện các mẫu bí mật đã biết, không thay thế việc kiểm tra và quản lý secret.

CI có ba job: **Backend security and money integrity**, **Browser session and failure safety**, **Verified source release**. Job phát hành phụ thuộc hai job test, chuẩn bị build sạch trước khi tạo ZIP và chỉ upload ZIP/checksum. Sau khi đưa workflow lên GitHub, bật branch protection/ruleset yêu cầu cả ba check này trước merge; chỉnh file workflow không tự bật quy tắc trên repository. CI không triển khai server và không nhận production credential.

## Phiên người dùng, email và script quản trị

Client xác minh phiên với server trước khi mở trang bảo vệ, bỏ credential/cache tài chính cũ khỏi localStorage, hủy request cũ khi chuyển phiên và đồng bộ đăng xuất giữa tab. Logout khi mất mạng vẫn khóa đăng nhập tự động trên trình duyệt đó cho tới lần đăng nhập có chủ ý tiếp theo; phiên máy chủ chỉ bị thu hồi khi request logout đến được server hoặc phiên hết hạn.

Đăng ký tạo tài khoản chưa xác minh email. Không coi cờ đăng nhập là bằng chứng email đã xác minh. Luồng gửi lại email xác minh và đặt lại mật khẩu cần SMTP cùng `CLIENT_URL` hợp lệ; phản hồi chung không bảo đảm thư đã gửi. Không ghi token/link reset vào log. Gửi thư production cần được kiểm tra riêng bằng tài khoản thử nghiệm được phép.

Cleanup và seed demo chỉ cho phép development/test trên database `caltdhy_dev` hoặc `caltdhy_test` và dùng URI riêng. Migration có thể chạy môi trường khác theo các tham số bảo vệ riêng, dry-run và xác nhận phạm vi; đọc hướng dẫn của từng script trước khi thực thi. Không cấp production URI cho tác vụ demo. Không tự động chạy các script này trong launcher hay CI.

Nếu ZIP cũ hoặc `.env` từng ra ngoài phạm vi tin cậy, chủ hệ thống phải xoay credential MongoDB/SMTP và khóa phiên tại nhà cung cấp, thu hồi credential cũ, rồi cập nhật cấu hình runtime. Sửa mã nguồn hoặc tạo ZIP sạch không tự thu hồi các bí mật đã lộ.

## Giới hạn cần theo dõi

Kiểm thử cục bộ và CI không chứng minh cấu hình HTTPS, backup/restore, gửi thư, giám sát hoặc phân quyền hạ tầng production. Cần xác nhận các mục này trên môi trường triển khai. Hiện việc đối soát số dư đọc lịch sử giao dịch của tài khoản trong transaction; theo dõi độ trễ/kích thước dữ liệu và thiết kế ledger tổng hợp có kiểm chứng khi tải tăng. Không tuyên bố chịu tải nhiều instance trước khi có kiểm thử tải và rate limit dùng chung.
