@echo off
setlocal
cd /d "%~dp0web"
set "GOMOKU_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%GOMOKU_NODE%" goto ready
where node >nul 2>nul
if errorlevel 1 goto missing
set "GOMOKU_NODE=node"
:ready
if not exist "node_modules\ws\package.json" goto setup
if not exist "dist\client\index.html" goto setup
echo.
echo YIJIAN - Swap2 Gomoku
echo Open http://localhost:4173/ in your browser after the server starts.
echo Keep this window open while playing. Press Ctrl+C to stop.
echo.
"%GOMOKU_NODE%" server\index.mjs
pause
exit /b
:missing
echo Node.js 22.13+ is required. Please install Node.js or use the Codex runtime.
pause
exit /b 1
:setup
echo First-time setup is required. See README.md for pnpm install and pnpm build.
pause
exit /b 1
