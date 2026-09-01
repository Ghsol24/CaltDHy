# CaltDHy — Quy tắc phân loại giao dịch tiền (Transfer vs Income/Expense)

> Đọc file này TRƯỚC khi thêm/sửa bất kỳ tính năng nào liên quan đến việc
> tiền di chuyển giữa các "nơi chứa" của người dùng (ví, hũ, thẻ tín dụng,
> tài khoản tiết kiệm...). Bỏ qua nguyên tắc này đã từng gây ra bug thật
> trong dự án (xem mục "Lịch sử bug" bên dưới).

## 1. Câu hỏi quyết định duy nhất

Trước khi chọn `type` cho một `Transaction` mới, luôn tự hỏi:

> **"Sau thao tác này, tiền có còn là của người dùng không?"**

- **Còn** (chỉ đổi chỗ cất) → `type: 'transfer'`
- **Mất** (ra khỏi hệ thống của người dùng, đến bên thứ ba) → `type: 'expense'`
- **Có thêm tiền mới** (từ bên ngoài vào, không phải tiền cũ quay lại) → `type: 'income'`

Không có ngoại lệ. Nếu thấy mình đang cân nhắc "thôi cứ ghi expense cho tiện,
category để 'Other Expense'" — đó chính là dấu hiệu sắp tái phạm bug đã xảy ra.

## 2. Ba tầng kiến trúc dữ liệu tiền

```
TẦNG 1 — Vị trí tiền (Asset/Storage)
  Ví tiền mặt ⇄ Ngân hàng ⇄ Hũ tiết kiệm ⇄ Thẻ tín dụng
  → luôn là TRANSFER. Không đụng đến income/expense, không đụng category.

TẦNG 2 — Dòng tiền ra/vào hệ thống (Cashflow)
  Lương, thưởng, bán đồ (income) | Mua sắm, hoá đơn, trả góp (expense)
  → tiền thật sự sinh ra hoặc mất đi khỏi người dùng.

TẦNG 3 — Danh mục hành vi (Behavioral Category)
  Ăn uống, Nhà cửa, Di chuyển, Giải trí...
  → CHỈ gắn cho giao dịch ở TẦNG 2. Tầng 1 không có danh mục hành vi thật,
    chỉ có nhãn mô tả (vd "Chuyển vào hũ") để hiển thị, KHÔNG dùng để tính
    ngân sách hay income/expense.
```

`calculateMonthlyStats` (financeMath.js) chỉ cộng dồn `byCategory` và
tổng income/expense cho `type === 'income' | 'expense'` — `transfer` bị bỏ
qua hoàn toàn. Đây chính là cơ chế giúp Tầng 1 không rò rỉ sang Tầng 2/3.

## 3. Bảng tra cứu nhanh khi code tính năng mới

| Hành động | `type` | `walletId` | `toWalletId` | `category` |
|---|---|---|---|---|
| Chuyển ví A → ví B | `transfer` | ví A | ví B | mô tả (vd "Chuyển tiền") |
| Nạp tiền vào Hũ | `transfer` | ví nguồn | *(để trống)* | mô tả (vd "Chuyển vào hũ") |
| Rút tiền từ Hũ | `transfer` | *(để trống)* | ví nhận | mô tả (vd "Chuyển từ hũ") |
| Trả góp / hoá đơn định kỳ | `expense` | ví trả | — | danh mục thật (Housing & Bills...) |
| Nhận lương / thu nhập | `income` | ví nhận | — | danh mục thật (Salary...) |
| Rút tiền mặt từ thẻ tín dụng vào ví | `transfer` | thẻ tín dụng | ví nhận | mô tả |

Quy tắc field: `walletId` = nơi tiền **rời đi**, `toWalletId` = nơi tiền
**đến**. Với `transfer`, chỉ cần set field nào có thật — không có "nơi
đến" hợp lệ (vd Hũ không nằm trong bảng `wallets`) thì để trống, đừng cố
nhét cho đủ cặp.

## 4. Checklist bắt buộc trước khi merge tính năng mới liên quan đến tiền

- [ ] Đã trả lời được câu hỏi ở mục 1 cho MỌI transaction mới được tạo.
- [ ] Nếu là `transfer`: đã kiểm tra `calculateMonthlyStats` và
      `BudgetsTab.jsx`/`AttentionPanel.jsx` KHÔNG vô tình đếm nó vào
      category/income/expense.
- [ ] Nếu là `expense`/`income`: category phải là danh mục hành vi thật
      (Tầng 3), không dùng "Other Expense"/"Other Income" như một cái sọt
      rác cho mọi thứ không biết xếp đâu.
- [ ] Đã test kịch bản "làm ngược lại ngay lập tức" (nạp rồi rút, chuyển đi
      rồi chuyển lại) và xác nhận **mọi** số liệu tổng hợp (ngân sách danh
      mục, thu nhập tháng, chi tiêu tháng, availableToSpend) đều trở về
      đúng giá trị ban đầu — không chỉ riêng số dư ví.

## 5. Lịch sử bug (để không lặp lại)

**Bug:** `PATCH /api/jars/:id/deposit` và `/withdraw` (routes/jars.js) từng
tạo Transaction với `type: 'expense', category: 'Other Expense'` (nạp) và
`type: 'income', category: 'Other Income'` (rút). Vì Tầng 1 bị ép đội lốt
Tầng 2/3, mỗi vòng nạp/rút hũ làm "Other Expense" phình to vĩnh viễn và
"Thu nhập tháng này" bị thổi phồng, dù `availableToSpend` (dựa trên số dư
ví thật) vẫn đúng — tạo cảm giác hai con số trên UI "mâu thuẫn nhau".

**Đã sửa:** đổi cả 2 handler sang `type: 'transfer'` theo đúng bảng ở
mục 3. Dữ liệu lịch sử được backfill bằng
`backEnd/server/scripts/migrate-jar-transfer-types.js` (an toàn chạy lại
nhiều lần, hỗ trợ `--dry-run`).

## 6. File liên quan

- `backEnd/server/routes/jars.js` — nơi tạo transaction cho nạp/rút hũ
- `backEnd/server/scripts/migrate-jar-transfer-types.js` — migration một lần
- `frontEnd-react/src/utils/financeMath.js` — `calculateMonthlyStats`,
  `calculateWalletBalances`, `calculateAvailableToSpend` (nơi transfer
  được loại trừ khỏi category/income/expense)
- `frontEnd-react/src/features/plan/BudgetsTab.jsx` — hiển thị ngân sách
  theo danh mục, có cảnh báo chi tiêu ngoài ngân sách
- `frontEnd-react/src/features/home/AttentionPanel.jsx` — banner cảnh báo
  vượt ngân sách ở trang chủ
