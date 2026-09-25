# Nghiệm thu sửa UX trên điện thoại — 25/09/2026

Phạm vi: bản build production chạy cục bộ, kiểm tra bằng Chrome giả lập điện thoại 320px và 390px với API giả lập. Không dùng tài khoản hoặc dữ liệu tài chính thật. Bản sửa **chưa được đẩy lên GitHub hoặc triển khai lên Render**.

## Đối chiếu nhận xét trước khi sửa

| Nhận xét của agent trong ảnh | Kết quả kiểm tra độc lập | Cách sửa |
| --- | --- | --- |
| Thanh điều hướng đáy che chỉ số cuối | Xác nhận ở Kế hoạch và Phân tích: khi cuộn hết, mép dưới nội dung khoảng 754px, còn thanh đáy bắt đầu tại 702px trên viewport 390×770. Ở Hũ, ảnh chụp tại vị trí cuộn chưa hết trông như bị che, nhưng nội dung cuối vẫn cuộn lên được. | Bỏ khai báo `padding: 0 !important` ghi đè khoảng trống 68px của `.app-shell`; đưa nút gợi ý vào luồng nội dung trên mobile. |
| Tab con đè tiêu đề và nút tạo kế hoạch | Xác nhận: thanh tab `top: 72px` trong khi header điện thoại thực tế khoảng 45px; tại một vị trí cuộn, điểm chạm giữa nút tạo kế hoạch trúng tab con. | Đặt vị trí sticky theo mép trên của viewport ở breakpoint điện thoại; giữ vùng cuộn dành cho tab. |
| Tab con bên phải bị cắt mà không có dấu hiệu vuốt | Xác nhận: tab đang chọn ở màn Lịch sử/Định kỳ có thể nằm ngoài vùng thấy được. | Tự cuộn tab đang chọn vào tầm nhìn và thêm chỉ dấu mờ/mũi tên ở mép còn nội dung. |
| Bố cục bị “kẹp bánh mì” | Đúng về cảm nhận, nhưng tỷ lệ diện tích 45–50% trong ảnh agent chỉ là ước lượng, không phải số đo chung cho mọi thiết bị. | Bỏ nút gợi ý nổi che dữ liệu, hạ chiều cao khối biểu đồ trên điện thoại và sửa các lớp che thực tế ở trên/dưới. |

Nguyên nhân agent nêu về `padding-bottom` của `.app-shell` bị triệt tiêu là đúng; quy tắc ghi đè cụ thể nằm trong `spa-overrides.css`. Nhận định `top: 72px` của tab con cũng đúng về mã nguồn; chiều cao header thực tế thay đổi theo breakpoint nên không thể dùng con số đó làm tọa độ cố định.

## Biểu đồ dòng tiền trên điện thoại

Sau khi sửa các lỗi điều hướng, biểu đồ ngày được chia thành các khoảng tối đa 7 ngày. Khoảng mặc định là khoảng có giao dịch gần nhất trong tháng; có nút 44px để chuyển tới khoảng trước/sau. Nhãn trục X giữ ngang, tối đa 7 nhãn; biểu đồ 3 và 6 tháng vẫn dùng chung bộ điều khiển. Ba nút chế độ nằm trọn một hàng ở 320px, nội dung chú giải chỉ còn một bản và màu cột theo token ngữ nghĩa của từng theme. Khoảng không có giao dịch có thông báo riêng. Biểu đồ có tên truy cập cho công cụ hỗ trợ; chỉ dẫn chọn ngày và bảng giao dịch bên dưới vẫn giữ nguyên.

Ảnh sau khi sửa, dữ liệu giả lập: [biểu đồ 320px](mobile-ux-evidence/cash-flow-320-dark-after.png) và [biểu đồ 390px](mobile-ux-evidence/cash-flow-390-dark-after.png), cùng theme tối.

## Kết quả kiểm tra

- Sau sửa, ở viewport 390×770, nội dung cuối Kế hoạch, Phân tích và Hũ nằm trên thanh đáy lần lượt khoảng 76px, 76px và 66px; nút tạo kế hoạch nhận đúng điểm chạm.
- Biểu đồ đã kiểm tra ở 8 tổ hợp (320px và 390px × dark, cream, green, light): không tràn ngang trang/panel/bộ điều khiển; thao tác chạm ba chế độ và đổi khoảng ngày hoạt động; không có lỗi JavaScript không xử lý.
- `npm run test:all` đạt: 29 kiểm tra frontend/guard, 59 backend, 18 tình huống trình duyệt, ngân sách bundle và kiểm tra phát hành. `npm run lint --prefix frontEnd-react` đạt, còn 3 cảnh báo đã có sẵn.

Giới hạn: chưa xác nhận bằng điện thoại Android/iPhone thật, bàn phím ảo thật, độ phóng đại của trình duyệt hoặc dữ liệu tài chính thực tế. Kết quả tại `caltdhy.onrender.com` chưa thay đổi vì chưa triển khai.
