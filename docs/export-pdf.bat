@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "HTML=%~dp0作品说明.html"
set "PDF=%~dp0异步密语花园-作品说明.pdf"
set "TEMP=%~dp0temp-doc.html"

echo.
echo ========================================
echo   异步密语花园 · 导出 PDF
echo ========================================
echo.

copy /Y "%HTML%" "%TEMP%" >nul

:: Try Google Chrome headless (ASCII temp path avoids encoding issues)
set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
  echo 使用 Google Chrome 生成 PDF...
  "%CHROME%" --headless=new --disable-gpu --run-all-compositor-stages-before-draw --virtual-time-budget=5000 --no-pdf-header-footer --print-to-pdf="%PDF%" "file:///%TEMP:\=/%"
  if exist "%PDF%" (
    del /Q "%TEMP%" 2>nul
    echo.
    echo 成功: %PDF%
    goto :done
  )
)

:: Try Microsoft Edge headless
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (
  echo 使用 Microsoft Edge 生成 PDF...
  "%EDGE%" --headless=new --disable-gpu --run-all-compositor-stages-before-draw --virtual-time-budget=5000 --no-pdf-header-footer --print-to-pdf="%PDF%" "file:///%TEMP:\=/%"
  if exist "%PDF%" (
    del /Q "%TEMP%" 2>nul
    echo.
    echo 成功: %PDF%
    goto :done
  )
)

del /Q "%TEMP%" 2>nul

:: Fallback: open HTML for manual print
echo 未找到可用的 headless 浏览器，打开 HTML 供手动打印...
echo.
echo 手动导出步骤:
echo   1. 在浏览器中按 Ctrl+P
echo   2. 目标打印机选择「另存为 PDF」或「Microsoft Print to PDF」
echo   3. 纸张 A4，边距默认，勾选「背景图形」
echo   4. 保存为: 异步密语花园-作品说明.pdf
echo.
start "" "%HTML%"
goto :end

:done
echo 重新生成: 双击本脚本 export-pdf.bat
echo.

:end
pause
