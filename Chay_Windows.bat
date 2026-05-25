@echo off
title Khoi dong CaltDHy
echo ========================================================
echo   🚀 CHUONG TRINH KHOI DONG CALTDHY CHO WINDOWS 🚀
echo ========================================================
echo.

:: Kiem tra Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] LOI: May tinh cua ban chua cai dat Node.js!
    echo Node.js la bat buoc de chay database va server local.
    echo.
    echo Vui long tai va cai dat Node.js tai link sau:
    echo 👉 https://nodejs.org/
    echo ^(Chon ban LTS - khuyen nghi^)
    echo.
    echo Sau khi cai dat xong, hay mo lai file nay.
    echo.
    pause
    exit /b
)

echo [V] Da tim thay Node.js.
echo.

:: Di chuyen vao backend
cd /d "%~dp0"
cd backEnd\server

:: Cai dat dependencies neu chua co
if not exist node_modules (
    echo [⚙] Dang tai cac thu vien can thiet (lan dau tien chay, mat 1-2 phut)...
    call npm install
    if %errorlevel% neq 0 (
        echo [X] LOI: Khong the cai dat thu vien. Vui long kiem tra ket noi mang.
        pause
        exit /b
    )
) else (
    echo [V] Cac thu vien da duoc cai dat day du.
)

echo.
echo [🚀] Dang khoi dong server CaltDHy...
echo ========================================================
echo.

:: Mo trinh duyet tu dong sau 2 giay
start "" http://localhost:24127

:: Chay server
node server.js

pause
