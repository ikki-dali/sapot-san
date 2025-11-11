# Googleカレンダー連携のSupabaseログインエラー修正手順

## 問題の概要

Googleカレンダー連携時に「Supabaseのログインが必要」というエラーが発生している場合、以下の原因が考えられます：

1. **SUPABASE_SERVICE_ROLE_KEYが未設定**: サーバーサイドで匿名キー（ANON_KEY）を使用しているため、RLS（Row Level Security）でブロックされている
2. **google_calendar_tokensテーブルのRLSが有効**: テーブルへのアクセスが認証ユーザーに制限されている
3. **GOOGLE_REDIRECT_URIの設定ミス**: 正しいAPIエンドポイントを指定する必要がある

## 修正手順

### Step 1: Supabase Service Role Keyを取得

1. Supabaseダッシュボードにアクセス: https://supabase.com/dashboard
2. プロジェクトを選択（ogomzppqppjyqbnqests）
3. 左メニュー → **Settings** → **API**
4. **Project API keys** セクションで **service_role** キーをコピー

### Step 2: .envファイルを更新

`.env`ファイルに以下を追加/更新してください：

```env
# Supabase Service Role Key（サーバーサイド用 - RLSをバイパス）
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Google Redirect URI を修正（正しいコールバックURLに）
# 開発環境の場合:
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-calendar/callback

# 本番環境の場合（Vercel等）:
# GOOGLE_REDIRECT_URI=https://your-app.vercel.app/api/google-calendar/callback
```

### Step 3: google_calendar_tokensテーブルのRLSを無効化

Supabaseダッシュボードで以下のSQLを実行:

1. Supabaseダッシュボード → **SQL Editor**
2. 以下のSQLを実行:

```sql
-- google_calendar_tokensテーブルのRLSを無効化
ALTER TABLE google_calendar_tokens DISABLE ROW LEVEL SECURITY;

-- 確認
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'google_calendar_tokens';
-- rowsecurity が false になっていればOK
```

### Step 4: Google Cloud ConsoleでRedirect URIを更新

1. Google Cloud Console (https://console.cloud.google.com/) にアクセス
2. プロジェクトを選択
3. **APIs & Services** → **Credentials**
4. OAuth 2.0 Client IDをクリック
5. **Authorized redirect URIs** に以下を追加（まだの場合）:
   - 開発: `http://localhost:3000/api/google-calendar/callback`
   - 本番: `https://your-app.vercel.app/api/google-calendar/callback`
6. **Save**

### Step 5: アプリケーションを再起動

```bash
# 開発環境
npm run dev

# または本番環境
npm start
```

### Step 6: 動作確認

1. Webダッシュボード（http://localhost:3000）にアクセス
2. ログイン
3. **Settings** → **Google Calendar連携** をクリック
4. エラーなくGoogleの認証画面にリダイレクトされることを確認
5. 認証完了後、正常にダッシュボードに戻ることを確認

## よくある質問

### Q1: Service Role Keyはどこで使われるの？

A: `src/db/connection.js`で自動的に使用されます。SERVICE_ROLE_KEYが設定されている場合、ANON_KEYより優先して使用されます。

```javascript
// SERVICE_ROLE_KEYがある場合はそれを使用（RLSをバイパス）
const supabaseKey = supabaseServiceKey || supabaseAnonKey;
```

### Q2: RLSを無効化しても安全？

A: `google_calendar_tokens`テーブルはサーバーサイドからのみアクセスされ、Service Role Keyで保護されているため安全です。フロントエンドから直接アクセスすることはありません。

### Q3: GOOGLE_REDIRECT_URIが間違っているとどうなる？

A: Googleの認証後、`redirect_uri_mismatch`エラーが発生し、認証が完了しません。必ずGoogle Cloud Consoleで設定したURIと一致させてください。

### Q4: 本番環境のURLは？

A: 本番環境のURLは以下のように確認できます：

- **Vercel**: プロジェクトダッシュボード → Deploymentsタブ → Production URLをコピー
- **Railway**: プロジェクト → Settings → Domains → Public domain をコピー
- **Heroku**: アプリダッシュボード → Settings → Domains セクション

## トラブルシューティング

### エラー: "SUPABASE_SERVICE_ROLE_KEY is not defined"

→ `.env`ファイルに`SUPABASE_SERVICE_ROLE_KEY`を追加してアプリを再起動してください。

### エラー: "redirect_uri_mismatch"

→ `.env`の`GOOGLE_REDIRECT_URI`とGoogle Cloud Consoleの設定が一致しているか確認してください。

### エラー: "Row level security policy violation"

→ Supabaseで`ALTER TABLE google_calendar_tokens DISABLE ROW LEVEL SECURITY;`を実行してください。

### 認証後に「認証エラー」が表示される

→ `.env`の`GOOGLE_CLIENT_ID`と`GOOGLE_CLIENT_SECRET`が正しいか確認してください。

## 修正完了の確認

以下がすべて完了していることを確認してください：

- [ ] `.env`に`SUPABASE_SERVICE_ROLE_KEY`を追加
- [ ] `.env`の`GOOGLE_REDIRECT_URI`を正しいURLに修正
- [ ] Supabaseで`google_calendar_tokens`のRLSを無効化
- [ ] Google Cloud Consoleで正しいRedirect URIを設定
- [ ] アプリケーションを再起動
- [ ] 実際にGoogleカレンダー連携が動作することを確認

以上で修正完了です！
