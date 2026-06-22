@echo off

chcp 65001 >nul

cd /d "%~dp0"

echo.

echo ========================================

echo   异步密语花园 · Cipher Garden

echo ========================================

echo.

echo 请勿直接双击 index.html（ES 模块需 HTTP 服务）

echo 启动后会自动打开浏览器。

echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"

echo.

pause

