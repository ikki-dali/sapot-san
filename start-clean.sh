#!/bin/bash

# サポ田さん - クリーンスタートスクリプト
# すべてのプロセスを停止して、環境変数をクリアして起動

echo "🔄 サポ田さんをクリーンスタート中..."
echo ""

# すべてのnode プロセスを停止
echo "1️⃣ 既存のプロセスを停止..."
pkill -9 -f "node server.js" 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
sleep 2
echo "   ✅ プロセス停止完了"
echo ""

# プロジェクトディレクトリに移動
cd "$(dirname "$0")"
echo "2️⃣ プロジェクトディレクトリ: $(pwd)"
echo ""

# 環境変数を確認
echo "3️⃣ 環境変数を確認..."
if grep -q "GOOGLE_REDIRECT_URI" .env; then
  REDIRECT_URI=$(grep "GOOGLE_REDIRECT_URI" .env | cut -d '=' -f2)
  echo "   GOOGLE_REDIRECT_URI: $REDIRECT_URI"

  if [[ "$REDIRECT_URI" == *"supabase.com"* ]]; then
    echo "   ⚠️  警告: REDIRECT_URIがSupabaseになっています"
    echo "   修正してください: GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-calendar/callback"
    exit 1
  fi
else
  echo "   ❌ .envにGOOGLE_REDIRECT_URIが設定されていません"
  exit 1
fi
echo "   ✅ 環境変数OK"
echo ""

# 環境変数をクリアして起動
echo "4️⃣ サーバーを起動..."
unset GOOGLE_REDIRECT_URI
unset GOOGLE_CLIENT_ID
unset GOOGLE_CLIENT_SECRET

# .envを読み込んでnode起動
exec node server.js

echo "✅ 起動完了！"
