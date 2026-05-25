#!/bin/bash

# Hiển thị thông báo tiếng Việt không dấu để tránh lỗi font trên một số Terminal cũ
echo "========================================================"
echo "  🚀 CHUONG TRINH KHOI DONG CALTDHY CHO MAC/LINUX 🚀"
echo "========================================================"
echo ""

# Kiem tra Node.js
if ! command -v node &> /dev/null
then
    echo "[❌ LỖI] May tinh cua ban chua cai dat Node.js!"
    echo "Node.js la bat buoc de chay database va server local."
    echo ""
    echo "Vui long tai va cai dat Node.js tai link sau:"
    echo "👉 https://nodejs.org/"
    echo "(Chon ban LTS - khuyen nghi)"
    echo ""
    echo "Sau khi cai dat xong, hay mo lai file nay."
    echo ""
    read -p "Nhan Enter de thoat..."
    exit 1
fi

echo "[✔] Da tim thay Node.js."
echo ""

# Di chuyen vao thu muc chua script
cd "$(dirname "$0")"
cd backEnd/server

# Cai dat dependencies neu chua co
if [ ! -d "node_modules" ]; then
    echo "[⚙] Dang tai cac thu vien can thiet (lan dau tien chay, mat 1-2 phut)..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[❌ LỖI] Khong the cai dat thu vien. Vui long kiem tra ket noi mang."
        read -p "Nhan Enter de thoat..."
        exit 1
    fi
else
    echo "[✔] Cac thu vien da duoc cai dat day du."
fi

echo ""
echo "[🚀] Dang khoi dong server CaltDHy..."
echo "========================================================"
echo ""

# Mo trinh duyet tu dong tren Mac
sleep 2
open http://localhost:24127 &

# Chay server
node server.js
