#!/bin/bash
# CaltDHy Launcher for macOS — v2.0 (React Edition)

# Tự động di chuyển đến thư mục hiện tại của script
cd "$(dirname "$0")"

# Thêm các đường dẫn phổ biến vào PATH
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:$PATH"

# Kiểm tra Node.js
if ! command -v node &> /dev/null; then
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        . "$HOME/.nvm/nvm.sh"
    elif [ -s "/opt/homebrew/opt/nvm/nvm.sh" ]; then
        . "/opt/homebrew/opt/nvm/nvm.sh"
    fi
fi

if ! command -v node &> /dev/null; then
    echo "[X] LỖI: Không tìm thấy Node.js!"
    echo "👉 https://nodejs.org/ (Chọn bản LTS)"
    read -p "Nhấn Enter để thoát..."
    exit 1
fi

echo "[V] Node.js: $(node -v)"
echo ""

# ── Bước 1: Thiết lập Backend ──
cd backEnd/server

if [ ! -f .mac_ready ]; then
    echo "[⚙] Lần đầu chạy trên macOS — đang cài đặt thư viện backend..."
    rm -rf node_modules
    npm install
    if [ $? -ne 0 ]; then
        echo "[X] LỖI: npm install thất bại."
        read -p "Nhấn Enter để thoát..."
        exit 1
    fi
    touch .mac_ready
    rm -f .windows_ready
    echo "[V] Backend ready!"
    echo ""
fi

# ── Bước 2: Build React Frontend (nếu chưa có dist) ──
cd "$(dirname "$0")/frontEnd"

if [ ! -d "dist" ]; then
    echo "[⚙] Chưa có bản build React. Đang build frontend..."
    if [ ! -d "node_modules" ]; then
        echo "[⚙] Đang cài đặt thư viện frontend..."
        npm install
        if [ $? -ne 0 ]; then
            echo "[X] LỖI: Không thể cài đặt frontend dependencies."
            read -p "Nhấn Enter để thoát..."
            exit 1
        fi
    fi
    npm run build
    if [ $? -ne 0 ]; then
        echo "[X] LỖI: Build React thất bại."
        read -p "Nhấn Enter để thoát..."
        exit 1
    fi
    echo "[V] Frontend build hoàn tất!"
    echo ""
fi

cd "$(dirname "$0")"

# ── Bước 3: Kiểm tra port và khởi động ──
if lsof -i:24127 -t > /dev/null; then
    echo "[!] Server đã chạy. Đang mở CaltDHy..."
    open "http://localhost:24127"
    sleep 1
    osascript -e 'tell application "Terminal" to close first window' &
    exit 0
fi

# Mở trình duyệt sau khi server khởi động
(sleep 2 && open "http://localhost:24127") &

echo "[🚀] Đang khởi động CaltDHy (React Edition)..."
echo "========================================================="
node backEnd/server/server.js
