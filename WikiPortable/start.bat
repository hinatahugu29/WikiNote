@echo off
chcp 65001 > nul
cls
echo ========================================
echo  📘 ポータブルWiki v2.0
echo ========================================
echo.

REM Node.jsがインストールされているか確認
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.jsがインストールされていません
    echo.
    echo Node.jsをインストールしてください:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM node_modulesが存在しない場合はnpm install
if not exist "node_modules" (
    echo 📦 初回セットアップ: 依存関係をインストール中...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ❌ インストールに失敗しました
        pause
        exit /b 1
    )
    echo.
    echo ✅ インストール完了！
    echo.
)

REM サーバー起動
echo 🚀 Wikiサーバーを起動しています...
echo.
start http://localhost:3000
node server.js

pause
