# CaltDHy

Ứng dụng quản lý tài chính cá nhân: ghi thu chi theo ví, đặt ngân sách tháng, theo dõi khoản định kỳ và tiết kiệm theo hũ mục tiêu. Giao diện React (PWA, cài được lên điện thoại/máy tính), API Express và MongoDB.

![Node.js](https://img.shields.io/badge/Node.js-24+-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-replica%20set-47A248?logo=mongodb&logoColor=white)

## Tính năng

| Khu vực | Chức năng |
| --- | --- |
| **Trang chủ** | Tiền có thể chi còn lại, thanh "Cần chú ý" (cảnh báo ngân sách từ 75%, khoản sắp đến hạn), giao dịch gần đây |
| **Giao dịch** | Thu nhập, chi tiêu (kèm phí), chuyển khoản giữa các ví; lịch sử có tìm kiếm và bộ lọc theo loại, danh mục, ví, thời gian; xem lịch sử chỉnh sửa của từng giao dịch |
| **Kế hoạch** | Ví & tài khoản (ví mặc định, lưu trữ/mở lại ví), ngân sách theo tháng cho từng danh mục, khoản định kỳ (trả góp, hóa đơn, tạm dừng/kết thúc) |
| **Phân tích** | Tổng quan thu chi, cơ cấu danh mục, biểu đồ xu hướng dòng tiền theo ngày / 3 tháng / 6 tháng, xuất CSV và in báo cáo |
| **Hũ chi tiêu** | Hũ tiết kiệm theo mục tiêu, có hạn hoàn thành tùy chọn; nạp/rút là chuyển tiền nội bộ với ví, không tính là thu chi |
| **Cài đặt** | 4 giao diện (tối, sáng, kem, xanh lá), 3 ngôn ngữ (Tiếng Việt, English, 简体中文), hiển thị VND hoặc USD, xuất toàn bộ dữ liệu JSON, đặt lại dữ liệu |
| **Tài khoản** | Đăng ký mở hoặc theo lời mời, xác minh email, quên/đặt lại mật khẩu qua Brevo hoặc Gmail |

### Nguyên tắc về tiền và bảo mật

- Tiền luôn lưu và tính bằng **số nguyên VND**. USD chỉ là lớp hiển thị, bật khi triển khai cung cấp tỷ giá có nguồn và thời điểm.
- Mọi thao tác thay đổi tiền chạy trong **transaction MongoDB** và có **`Idempotency-Key`** để gửi lại không bị ghi trùng. Vì vậy MongoDB bắt buộc là replica set hoặc sharded cluster.
- Phiên đăng nhập là cookie **HttpOnly, SameSite=Strict** kèm token CSRF, không lưu credential trong `localStorage`.
- API có Helmet, CORS whitelist, rate limit theo IP (riêng cho API đăng nhập) và hỗ trợ chạy sau reverse proxy.
- PWA chỉ cache tài nguyên giao diện tĩnh, không cache `/api` hay dữ liệu tài chính.

## Công nghệ

| Phần | Thư viện chính |
| --- | --- |
| Frontend | React 19, React Router, Zustand, Chart.js, Vite 8, vite-plugin-pwa, oxlint |
| Backend | Express 4, Mongoose 8, Helmet, express-rate-limit, bcryptjs, Nodemailer |
| Kiểm thử | `node:test`, Supertest, mongodb-memory-server, Playwright (Chromium) |
| Triển khai | Render (`render.yaml`), GitHub Actions, launcher macOS `CaltDHy.app` |

## Cấu trúc thư mục

```text
CaltDHy/
├── backEnd/server/        API Express
│   ├── models/            Schema Mongoose (Transaction, Wallet, Jar, Budget, Installment, ...)
│   ├── routes/            auth, spending, wallets, jars
│   ├── middleware/        Xác thực phiên
│   ├── utils/             Tiền, ngày, transaction, i18n, bảo mật phiên
│   ├── scripts/           Migration, tạo lời mời, script quản trị
│   └── tests/             Test tích hợp với MongoDB tạm
├── frontEnd-react/        React SPA
│   └── src/
│       ├── features/      home, plan, analytics, transactions, jars, account, guide
│       ├── pages/         Landing, đăng nhập, đăng ký, xác minh email, đặt lại mật khẩu
│       ├── stores/        Zustand stores
│       ├── services/      Gọi API
│       └── i18n/          Bản dịch vi / en / zh-CN
├── tests/                 Test trình duyệt (Playwright) và kiểm tra phát hành
├── scripts/               start-all.js (chạy dev), release.cjs (đóng gói)
├── docs/                  Tài liệu vận hành và quy tắc nghiệp vụ
├── CaltDHy.app/           Launcher macOS chạy bản đã build tại máy
└── render.yaml            Mẫu triển khai Render
```

## Chạy trên máy phát triển

### 1. Yêu cầu

- **Node.js 24+** (xem `.node-version`)
- **MongoDB có transaction**: replica set hoặc sharded cluster. Backend từ chối khởi động với MongoDB standalone. Có thể dùng MongoDB Atlas, hoặc tạo replica set một node tại máy:

  ```bash
  mongod --replSet rs0 --dbpath ./data/db
  ```

  Sau đó chạy `rs.initiate()` một lần trong `mongosh`.

### 2. Cài dependency

```bash
npm ci --ignore-scripts
```

```bash
npm ci --ignore-scripts --prefix backEnd/server
```

```bash
npm ci --ignore-scripts --prefix frontEnd-react
```

### 3. Cấu hình

```bash
cp backEnd/server/.env.example backEnd/server/.env
```

Mở `backEnd/server/.env` và điền tối thiểu:

| Biến | Giá trị khi phát triển |
| --- | --- |
| `MONGODB_URI` | Ví dụ `mongodb://127.0.0.1:27017/caltdhy_dev?replicaSet=rs0` |
| `JWT_SECRET` | Chuỗi ngẫu nhiên tối thiểu 32 byte (lệnh tạo bên dưới) |
| `CLIENT_URL` | `http://localhost:5173` nếu cần thử liên kết trong email |
| `REGISTRATION_MODE` | `open` để tự đăng ký, hoặc giữ `invite` |

Tạo `JWT_SECRET` ngẫu nhiên:

```bash
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

`JWT_SECRET` hiện dùng làm khóa HMAC cho phiên và CSRF (tên biến giữ lại để tương thích). Các biến còn lại như email, rate limit, proxy, cookie được giải thích ngay trong `.env.example`. Hiển thị USD là tùy chọn, cấu hình qua `frontEnd-react/.env.example`.

> Không commit `.env` thật và không đặt bí mật vào biến `VITE_*`, vì các biến này được đưa vào mã phía client.

### 4. Chạy

```bash
npm run dev
```

Lệnh này mở backend tại `http://127.0.0.1:24127` (chế độ development) và Vite tại `http://localhost:5173`. Vite chuyển tiếp `/api` sang backend. Mở địa chỉ Vite sau khi cả hai dịch vụ sẵn sàng.

## Kiểm thử

Test dùng dữ liệu tổng hợp và MongoDB tạm (mongodb-memory-server), không chạm vào database thật.

```bash
npx --no-install playwright install chromium
```

```bash
npm run test:all
```

| Lệnh | Nội dung |
| --- | --- |
| `npm test` | Unit test frontend, test tích hợp backend, kiểm tra launcher và release |
| `npm run test:e2e` | Build frontend rồi chạy test trình duyệt: bảo mật phiên, ngân sách hiệu năng UX, dòng tiền, mobile, tương phản theme |
| `npm run test:all` | `test` + `test:e2e` + `check:release` |
| `npm run lint --prefix frontEnd-react` | Lint frontend bằng oxlint |

GitHub Actions (`.github/workflows/test.yml`) chạy `npm audit`, toàn bộ test và tạo gói mã nguồn đã kiểm tra cho mỗi lần push và pull request.

## Build và triển khai

### Production

```bash
npm run build --prefix frontEnd-react
```

```bash
npm start
```

Backend phục vụ cả giao diện đã build (`frontEnd-react/dist`) và `/api` trên cùng một origin. Với website HTTPS, đặt `NODE_ENV=production`, `COOKIE_SECURE=true` và `CLIENT_URL` là URL HTTPS thật. Health check: `GET /api/health`.

### Render

`render.yaml` là mẫu cho một dịch vụ Render **mới**. Cần tự cấp `MONGODB_URI`, `BREVO_API_KEY`, `EMAIL_FROM`; `JWT_SECRET` được Render sinh tự động. Render Free chặn cổng SMTP, nên gửi email qua API HTTPS của Brevo. Nếu đã có dịch vụ đang chạy, nâng cấp trong phần cài đặt của dịch vụ đó để giữ URL, database và bí mật. Các bước chi tiết và cách mời người dùng cài ứng dụng nằm trong [hướng dẫn triển khai PWA](docs/PWA-DEPLOYMENT.md).

### Đóng gói phát hành

```bash
npm run prepare:release
```

```bash
npm run package:source
```

`prepare:release` tạo bản chạy được (đã cài dependency và build giao diện) trong `release/`. `package:source` tạo file ZIP mã nguồn sạch kèm checksum SHA-256; đây không phải ứng dụng macOS độc lập. Không đưa `.env` thật vào ZIP hoặc frontend.

### Launcher macOS

`CaltDHy.app` chạy ứng dụng tại máy qua `http://localhost:24127` ở chế độ production, dùng bản build giao diện và dependency backend có sẵn. Launcher chỉ dùng HTTP loopback nên cần `COOKIE_SECURE=false`; không dùng cấu hình này cho website công khai.

## Script quản trị

| Lệnh | Mục đích |
| --- | --- |
| `node backEnd/server/scripts/create-invitation.js EMAIL [NGÀY]` | Tạo URL mời đăng ký một lần cho đúng email, hết hạn sau 1–30 ngày (mặc định 7) |
| `npm run migrate:email` | Chuẩn hóa `emailVerified` thiếu/null thành `false` cho user chỉ định |
| `npm run migrate:dates` | Chuyển ngày giao dịch dạng chuỗi `YYYY-MM-DD` sang kiểu Date |
| `npm run migrate:jar-transfers` | Sửa cách phân loại giao dịch hũ cũ sang chuyển khoản nội bộ, không đổi số tiền |

Các migration mặc định chạy thử (dry-run), chỉ xử lý user và giao dịch được chỉ định, và cần URI database riêng thay vì đọc `.env` của ứng dụng. Sao lưu và thử khôi phục dữ liệu trước khi áp dụng.

## Tài liệu

| Tài liệu | Nội dung |
| --- | --- |
| [PRODUCTION-RUNBOOK.md](docs/PRODUCTION-RUNBOOK.md) | Điều kiện triển khai, kiểm tra trước nâng cấp dữ liệu, HTTPS/cookie, proxy, idempotency, giới hạn cần theo dõi |
| [PWA-DEPLOYMENT.md](docs/PWA-DEPLOYMENT.md) | Triển khai lên Render, tạo lời mời, cài ứng dụng lên điện thoại/máy tính |
| [financial-transaction-rules.md](docs/financial-transaction-rules.md) | Quy tắc phân biệt chuyển khoản với thu/chi, checklist trước khi merge tính năng liên quan đến tiền |
| [transaction-editing-rules.md](docs/transaction-editing-rules.md) | Chỉnh sửa giao dịch và ảnh hưởng đến ngân sách theo tháng |
| [i18n-display-currency.md](docs/i18n-display-currency.md) | Đa ngôn ngữ và hiển thị USD |

**Đọc runbook trước khi** nâng cấp dữ liệu, cấu hình HTTPS/cookie, chạy script quản trị hoặc phát hành.
