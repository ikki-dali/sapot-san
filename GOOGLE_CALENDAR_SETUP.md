# Googleカレンダー連携セットアップガイド

## 🚀 クイックスタート

### 1. 環境変数の設定

`.env`ファイルに以下を設定：

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-calendar/callback
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Supabaseテーブルの作成

Supabaseダッシュボードで以下のSQLを実行：

```sql
-- google_calendar_tokensテーブルを作成
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id SERIAL PRIMARY KEY,
  slack_user_id VARCHAR(255) UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  calendar_id VARCHAR(255) DEFAULT 'primary',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_slack_user_id
ON google_calendar_tokens(slack_user_id);

-- RLSを無効化（サーバーサイドでSERVICE_ROLE_KEYを使用）
ALTER TABLE google_calendar_tokens DISABLE ROW LEVEL SECURITY;
```

### 3. サーバーを起動

```bash
# 新しいターミナルを開く（環境変数をクリーンにするため）
cd /Users/yamamotoikki/sapota-san
npm start
```

## 📚 API仕様

### OAuth認証を開始

**GET** `/api/google-calendar/auth?slack_user_id=<USER_ID>`

ユーザーをGoogleの認証画面にリダイレクトします。

### 連携状態を確認

**GET** `/api/google-calendar/status?slack_user_id=<USER_ID>`

Response:
```json
{
  "success": true,
  "connected": true/false
}
```

### カレンダー一覧を取得（新機能）

**GET** `/api/google-calendar/calendars?slack_user_id=<USER_ID>`

ユーザーのGoogleカレンダー一覧を取得します。

Response:
```json
{
  "success": true,
  "calendars": [
    {
      "id": "primary",
      "summary": "山本さんの予定",
      "description": "メインカレンダー",
      "primary": true,
      "accessRole": "owner",
      "backgroundColor": "#9fe1e7"
    },
    {
      "id": "work@gmail.com",
      "summary": "仕事",
      "description": "仕事用カレンダー",
      "primary": false,
      "accessRole": "owner",
      "backgroundColor": "#f83a22"
    }
  ]
}
```

### 使用するカレンダーを選択（新機能）

**POST** `/api/google-calendar/select-calendar`

Body:
```json
{
  "slack_user_id": "U12345",
  "calendar_id": "work@gmail.com"
}
```

Response:
```json
{
  "success": true,
  "message": "カレンダーが設定されました",
  "calendar_id": "work@gmail.com"
}
```

### 連携を解除

**POST** `/api/google-calendar/disconnect`

Body:
```json
{
  "slack_user_id": "U12345"
}
```

## 🎯 使用シナリオ

### シナリオ1: 初回連携

1. ユーザーが`/api/google-calendar/auth?slack_user_id=U12345`にアクセス
2. Googleアカウントでログインして許可
3. コールバックURLに戻り、トークンがデータベースに保存
4. デフォルトで`primary`カレンダーが使用される

### シナリオ2: カレンダーを変更

1. `/api/google-calendar/calendars?slack_user_id=U12345`でカレンダー一覧を取得
2. 使いたいカレンダーの`id`をコピー
3. `/api/google-calendar/select-calendar`でカレンダーを選択

```bash
curl -X POST http://localhost:3000/api/google-calendar/select-calendar \
  -H "Content-Type: application/json" \
  -d '{
    "slack_user_id": "U12345",
    "calendar_id": "work@gmail.com"
  }'
```

4. 以降、タスクはこのカレンダーに追加される

## ⚠️ トラブルシューティング

### 問題: "Supabaseのログインが必要"と表示される

**原因**: シェルの環境変数として古い`GOOGLE_REDIRECT_URI`が設定されている

**解決方法**:

```bash
# 1. 環境変数を確認
printenv | grep GOOGLE_REDIRECT_URI

# 2. 古い値が表示された場合、ターミナルを再起動
# 3. 新しいターミナルでサーバーを起動
npm start
```

### 問題: "redirect_uri_mismatch"エラー

**原因**: Google Cloud Consoleの設定とREDIRECT_URIが一致していない

**解決方法**:

1. Google Cloud Console → APIs & Services → Credentials
2. OAuth 2.0 Client IDをクリック
3. Authorized redirect URIsに以下を追加：
   - 開発: `http://localhost:3000/api/google-calendar/callback`
   - 本番: `https://your-app.vercel.app/api/google-calendar/callback`

### 問題: カレンダー一覧が取得できない

**原因**: OAuth認証が完了していない

**解決方法**:

```bash
# 1. 連携状態を確認
curl "http://localhost:3000/api/google-calendar/status?slack_user_id=U12345"

# 2. connectedがfalseの場合、再度認証
open "http://localhost:3000/api/google-calendar/auth?slack_user_id=U12345"
```

## 🎨 Webダッシュボードでの使用

将来、Webダッシュボードに以下の機能を追加予定：

1. **設定画面**
   - Googleカレンダー連携ボタン
   - 連携済みカレンダーの表示
   - カレンダー選択UI

2. **タスク作成画面**
   - 選択したカレンダーにタスクを追加
   - カレンダーイベントとして表示

3. **統合ビュー**
   - Slackタスク + Googleカレンダーイベントを一覧表示
   - 双方向同期

## 📝 開発者向けメモ

### カレンダーIDの取得方法

Googleカレンダーの設定から：
1. カレンダー設定を開く
2. 「カレンダーの統合」セクション
3. 「カレンダーID」をコピー

主なカレンダーID形式：
- プライマリ: `primary`
- 個人: `your-email@gmail.com`
- 共有: `shared-calendar-id@group.calendar.google.com`

### データベーススキーマ

```sql
SELECT * FROM google_calendar_tokens;
```

| id | slack_user_id | calendar_id | created_at | updated_at |
|----|---------------|-------------|------------|------------|
| 1 | U09CAH6FZPW | primary | 2025-10-30... | 2025-11-06... |
| 2 | U12345 | work@gmail.com | 2025-11-06... | 2025-11-06... |

### 拡張アイデア

- [ ] カレンダーの色をタスクの優先度に応じて変更
- [ ] 複数のカレンダーに同時に追加
- [ ] カレンダーイベントからタスクを自動作成
- [ ] リマインダーの設定（カレンダーイベントの通知）
- [ ] 定期タスクの対応

## 🔗 関連リンク

- [Google Calendar API ドキュメント](https://developers.google.com/calendar/api/v3/reference)
- [OAuth 2.0 認証フロー](https://developers.google.com/identity/protocols/oauth2)
- [Supabase ドキュメント](https://supabase.com/docs)
