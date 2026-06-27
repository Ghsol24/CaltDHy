#!/bin/bash
# CaltDHy Launcher for macOS

# Tự động di chuyển đến thư mục hiện tại của script
cd "$(dirname "$0")"

# Thêm các đường dẫn phổ biến vào PATH để đảm bảo tìm thấy Node/NPM
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:$PATH"

# Kiểm tra Node.js
if ! command -v node &> /dev/null; then
    # Thử load nvm nếu có
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        . "$HOME/.nvm/nvm.sh"
    elif [ -s "/opt/homebrew/opt/nvm/nvm.sh" ]; then
        . "/opt/homebrew/opt/nvm/nvm.sh"
    fi
fi

if ! command -v node &> /dev/null; then
    echo "[X] LỖI: Không tìm thấy Node.js trên máy tính của bạn!"
    echo "Node.js là bắt buộc để chạy database và server local."
    echo ""
    echo "Vui lòng tải và cài đặt Node.js tại link sau:"
    echo "👉 https://nodejs.org/ (Chọn bản LTS)"
    echo ""
    read -p "Nhấn Enter để thoát..."
    exit 1
fi

echo "[V] Đã tìm thấy Node.js: $(node -v)"
echo ""

# Di chuyển vào backend/server để thiết lập/chạy
cd backEnd/server

# Tự động dọn dẹp và đồng bộ hóa thư viện từ Windows sang Mac
if [ ! -f .mac_ready ]; then
    echo "[⚙] Phát hiện đây là lần đầu tiên chạy trên macOS sau khi dùng Windows."
    echo "[⚙] Đang tự động thiết lập lại thư viện tương thích cho macOS..."
    if [ -d node_modules ]; then
        echo "[⚙] Đang xóa thư mục node_modules cũ..."
        rm -rf node_modules
    fi
    echo "[⚙] Đang chạy npm install..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[X] LỖI: Không thể cài đặt thư viện. Vui lòng kiểm tra kết nối mạng."
        read -p "Nhấn Enter để thoát..."
        exit 1
    fi
    touch .mac_ready
    if [ -f .windows_ready ]; then
        rm -f .windows_ready
    fi
    echo "[V] Thiết lập thư viện hoàn tất!"
    echo ""
fi

# Kiểm tra xem cổng 24127 đã có ứng dụng nào chạy chưa
if lsof -i:24127 -t >/dev/null; then
    echo "[!] Cổng 24127 đã hoạt động. Đang mở dự án CaltDHy..."
    open "http://localhost:24127"
    sleep 1
    # Tự động đóng cửa sổ Terminal này vì máy chủ đã chạy sẵn
    osascript -e 'tell application "Terminal" to close first window' &
    exit 0
fi

# Mở trình duyệt sau khi server khởi động
(sleep 1.5 && open "http://localhost:24127") &

echo "[🚀] Đang khởi động server CaltDHy..."
echo "========================================================"
node server.js
