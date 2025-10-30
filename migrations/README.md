# データベースマイグレーション手順

## remindersテーブルの作成

カスタムリマインダー機能を使用するには、`reminders`テーブルを作成する必要があります。

### 手順

1. **Supabase Dashboard**にアクセス
   - https://supabase.com/dashboard にログイン
   - プロジェクトを選択

2. **SQL Editor**を開く
   - 左サイドバーから「SQL Editor」をクリック
   - 「New query」をクリック

3. **SQLを実行**
   - `001_create_reminders_table.sql`の内容をコピー
   - SQL Editorにペースト
   - 「Run」ボタンをクリック

4. **確認**
   - 左サイドバーの「Table Editor」から`reminders`テーブルが作成されているか確認

### トラブルシューティング

#### エラー: "relation already exists"
テーブルが既に存在しています。問題ありません。

#### エラー: "permission denied"
Supabaseプロジェクトの管理者権限が必要です。

### マイグレーション一覧

- `001_create_reminders_table.sql` - カスタムリマインダーテーブル作成

## コマンドラインから実行する場合（上級者向け）

```bash
# psqlがインストールされている場合
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f migrations/001_create_reminders_table.sql
```

DATABASE_URLは`.env`ファイルに記載されています。
