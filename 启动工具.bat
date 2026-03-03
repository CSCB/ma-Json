@echo off
cd /d "%~dp0"
node launcher.js
if %errorlevel% neq 0 (
    echo.
    echo -----------------------------------------------------------------
    echo  Unable to run launcher.js. Please make sure Node.js is installed.
    echo  Note: You can also just double-click 'index.html' to use the tool.
    echo -----------------------------------------------------------------
    echo.
    pause
)
