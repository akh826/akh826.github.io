@echo off
setlocal EnableExtensions
set "EXT_DIR=%~dp0"
if "%EXT_DIR:~-1%"=="\" set "EXT_DIR=%EXT_DIR:~0,-1%"

if not exist "%EXT_DIR%\manifest.json" (
    echo Storage Inspector folder is incomplete. Extract the full ZIP, then run Install.bat again.
    pause
    exit /b 1
)

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"

if exist "%CHROME%" (
    start "" "%CHROME%" --load-extension="%EXT_DIR%"
    echo.
    echo Storage Inspector loaded in Chrome for this session.
    echo Pin the extension from the puzzle icon, then open any website tab.
    goto :done
)

if exist "%EDGE%" (
    start "" "%EDGE%" --load-extension="%EXT_DIR%"
    echo.
    echo Storage Inspector loaded in Edge for this session.
    echo Pin the extension from the puzzle icon, then open any website tab.
    goto :done
)

echo Could not find Chrome or Edge.
echo.
echo Manual install: open chrome://extensions, enable Developer mode,
echo click Load unpacked, and select:
echo   %EXT_DIR%
pause
exit /b 1

:done
echo.
echo To keep it after restart: chrome://extensions -^> Load unpacked -^> same folder.
timeout /t 5 >nul
