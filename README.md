# CaltDHy

Ứng dụng React SPA, API Express và MongoDB cho quản lý tài chính cá nhân.

## Bắt đầu

Cần Node.js 24+ và MongoDB replica set. Cài dependency theo lockfile:

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix backEnd/server
npm ci --ignore-scripts --prefix frontEnd-react
```

Chuẩn bị cấu hình riêng theo `backEnd/server/.env.example`, cấp URI database phát triển và khóa phiên ngẫu nhiên. `npm run dev` mở hai dịch vụ; truy cập địa chỉ Vite sau khi cả hai dịch vụ sẵn sàng. Môi trường production phục vụ giao diện đã build từ cùng backend qua `npm start`.

## Kiểm tra và phát hành

```sh
npx --no-install playwright install chromium
npm run test:all
npm run prepare:release
npm run package:source
```

Test dùng dữ liệu tổng hợp và MongoDB tạm. `prepare:release` tạo runtime đã cài dependency/build trong `release/`; `package:source` tạo ZIP mã nguồn sạch và checksum, không phải app macOS độc lập. Không đưa `.env` thật vào ZIP hoặc frontend.

Đọc [hướng dẫn production](docs/PRODUCTION-RUNBOOK.md) trước nâng cấp dữ liệu, cấu hình HTTPS/cookie, chạy script quản trị hoặc phát hành. Hướng dẫn nêu các kiểm tra bắt buộc, phạm vi bảo đảm của idempotency, vận hành sau proxy và các công việc phải làm tại hạ tầng triển khai.

Để chia sẻ ứng dụng qua URL HTTPS và cho phép cài lên điện thoại/máy tính, đọc [hướng dẫn triển khai PWA](docs/PWA-DEPLOYMENT.md).
