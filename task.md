# TASK: MIGRATION DATA TO MONGODB

## 1. BỐI CẢNH (CONTEXT)
Dự án CaltDHy đang lưu trữ dữ liệu offline (bằng file `data.json` / LocalStorage). Cần chuyển đổi toàn bộ luồng lưu trữ sang MongoDB Atlas để dữ liệu không bị mất khi server restart. 

## 2. YÊU CẦU ĐỐI VỚI AI AGENT
Hãy tự động quét và phân tích các file sau trong workspace:
- File `server.js` để hiểu luồng middleware và setup hiện tại.
- File `data.json` (hoặc các file trong thư mục `utils/`) để nắm bắt chính xác cấu trúc dữ liệu cũ (Schema design).
- Thư mục `routes/` (như `spending.js`) để xem cách các API đang hoạt động và cấu trúc response trả về cho frontend.

## 3. NHIỆM VỤ THỰC THI (CORE TASKS)
Sau khi phân tích xong, hãy thực hiện Refactoring toàn bộ theo các bước sau:

**A. Khởi tạo Models (Mongoose):**
- Tạo thư mục `models/`.
- Viết các Schema tương ứng với dữ liệu cũ (ví dụ: `Transaction`, `Budget`). 
- Định nghĩa rõ kiểu dữ liệu (String, Number, Date), các trường bắt buộc (`required`), và giá trị mặc định.

**B. Cập nhật Database Connection:**
- Chèn logic kết nối MongoDB (dùng `mongoose.connect(process.env.MONGODB_URI)`) vào `server.js`.
- Bắt buộc phải có try/catch để xử lý lỗi kết nối.

**C. Cập nhật Routes / Controllers:**
- Thay thế toàn bộ logic đọc/ghi file tĩnh hiện tại bằng các Mongoose query (`find`, `create`, `findByIdAndUpdate`, `findByIdAndDelete`).
- **RÀNG BUỘC CỐT LÕI:** Cấu trúc JSON response trả về cho Frontend KHÔNG ĐƯỢC THAY ĐỔI. Nếu cấu trúc cũ dùng field `id`, hãy đảm bảo map `_id` của MongoDB thành `id` trước khi trả về client để Frontend không bị sập.

## 4. ĐẦU RA (OUTPUT)
- Cung cấp mã nguồn hoàn chỉnh cho các file cần tạo mới (Models).
- Cung cấp mã nguồn đã được sửa đổi cho các file hiện tại (`server.js`, `routes/...`).
- Giải thích ngắn gọn về cách thiết kế Schema. Bắt tay vào làm ngay!