#!/bin/bash

echo "========================================"
echo " 📘 ポータブルWiki v2.0"
echo "========================================"
echo ""

# Node.jsがインストールされているか確認
if ! command -v node &> /dev/null; then
    echo "❌ Node.jsがインストールされていません"
    echo ""
    echo "Node.jsをインストールしてください:"
    echo "https://nodejs.org/"
    echo ""
    exit 1
fi

# node_modulesが存在しない場合はnpm install
if [ ! -d "node_modules" ]; then
    echo "📦 初回セットアップ: 依存関係をインストール中..."
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo "❌ インストールに失敗しました"
        exit 1
    fi
    echo ""
    echo "✅ インストール完了！"
    echo ""
fi

# サーバー起動
echo "🚀 Wikiサーバーを起動しています..."
echo ""

# OSに応じてブラウザを開く
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:3000
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://localhost:3000 2>/dev/null
fi

node server.js
