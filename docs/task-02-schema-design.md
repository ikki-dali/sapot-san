# タスク2: タスクテーブルのスキーマ設計

**フェーズ**: Phase 1 - データベース統合
**難易度**: Medium
**推定時間**: 1時間
**依存関係**: タスク1（データベース選定と環境構築）

## 🎯 目標

タスクデータを格納するPostgreSQLテーブルを設計し、Supabaseにマイグレーションを適用する。

## 📋 背景

現在In-memoryで管理しているタスクデータを永続化するためのテーブル構造を定義します。将来の拡張（タグ、優先度、プロジェクト分類など）も考慮した設計にします。

## 🗃️ テーブル設計

### `tasks`テーブル

| カラム名 | データ型 | 制約 | 説明 |
|---------|---------|------|------|
| id | BIGSERIAL | PRIMARY KEY | 内部ID（自動採番） |
| task_id | VARCHAR(255) | UNIQUE NOT NULL | タスクID（task_1234567890形式） |
| text | TEXT | NOT NULL | タスク内容 |
| channel | VARCHAR(255) | NOT NULL | SlackチャンネルID |
| message_ts | VARCHAR(255) | NOT NULL | Slackメッセージのタイムスタンプ |
| created_by | VARCHAR(255) | NOT NULL | タスク作成者のSlackユーザーID |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | タスク作成日時 |
| status | VARCHAR(50) | DEFAULT 'open' | タスクステータス（open/completed） |
| assignee | VARCHAR(255) | | 担当者のSlackユーザーID |
| due_date | TIMESTAMP WITH TIME ZONE | | 期限日時 |
| completed_at | TIMESTAMP WITH TIME ZONE | | タスク完了日時 |
| completed_by | VARCHAR(255) | | タスク完了者のSlackユーザーID |
| priority | INTEGER | | 優先度（1:低、2:中、3:高）※将来用 |
| tags | TEXT[] | | タグ配列 ※将来用 |
| summary | TEXT | | AI生成の要約 ※将来用 |

### インデックス設計

```sql
-- タスクIDでの高速検索
CREATE INDEX idx_tasks_task_id ON tasks(task_id);

-- ステータスでのフィルタリング
CREATE INDEX idx_tasks_status ON tasks(status);

-- 担当者でのフィルタリング
CREATE INDEX idx_tasks_assignee ON tasks(assignee);

-- 期限日でのソート
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;

-- チャンネルでのフィルタリング
CREATE INDEX idx_tasks_channel ON tasks(channel);
```

## ✅ 実装手順

### チェックリスト
- [x] マイグレーションSQLを作成
- [x] Supabaseにマイグレーションを適用
- [x] テーブル作成を確認
- [ ] RLSを設定（オプション）
- [x] サンプルデータを挿入してテスト
- [x] データ取得を確認

---

### Step 1: マイグレーションSQLの作成

`migrations/001_create_tasks_table.sql`というファイルを作成（後でSupabaseに適用）:

```sql
-- タスクテーブルの作成
CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  task_id VARCHAR(255) UNIQUE NOT NULL,
  text TEXT NOT NULL,
  channel VARCHAR(255) NOT NULL,
  message_ts VARCHAR(255) NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled')),
  assignee VARCHAR(255),
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by VARCHAR(255),
  priority INTEGER CHECK (priority BETWEEN 1 AND 3),
  tags TEXT[],
  summary TEXT
);

-- インデックスの作成
CREATE INDEX idx_tasks_task_id ON tasks(task_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee);
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_tasks_channel ON tasks(channel);

-- コメント追加（ドキュメント化）
COMMENT ON TABLE tasks IS 'サポ田さんのタスク管理テーブル';
COMMENT ON COLUMN tasks.task_id IS 'ユーザー向けのタスクID（task_1234567890形式）';
COMMENT ON COLUMN tasks.message_ts IS 'Slackメッセージのタイムスタンプ（スレッド返信用）';
COMMENT ON COLUMN tasks.status IS 'タスクステータス: open, completed, cancelled';
COMMENT ON COLUMN tasks.priority IS '優先度: 1=低, 2=中, 3=高';
```

### Step 2: Supabaseにマイグレーションを適用

Claude Code（MCP経由）でマイグレーションを実行:

```
mcp__supabase__apply_migration

パラメータ:
- project_id: (タスク1で取得したプロジェクトID)
- name: "create_tasks_table"
- query: (上記のSQL全文)
```

### Step 3: テーブル作成の確認

```
mcp__supabase__list_tables

パラメータ:
- project_id: (プロジェクトID)
- schemas: ["public"]
```

`tasks`テーブルが表示されればOK。

### Step 4: Row Level Security (RLS)の設定（オプション）

セキュリティを強化する場合、RLSを有効化:

```sql
-- RLSを有効化
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが読み取り可能（Slack Botとして動作するため）
CREATE POLICY "Enable read access for all users" ON tasks
  FOR SELECT
  USING (true);

-- 全ユーザーが挿入可能
CREATE POLICY "Enable insert access for all users" ON tasks
  FOR INSERT
  WITH CHECK (true);

-- 全ユーザーが更新可能
CREATE POLICY "Enable update access for all users" ON tasks
  FOR UPDATE
  USING (true);
```

※今回はバックエンド（Node.js）からのアクセスのみなので、RLSは任意です。

### Step 5: サンプルデータの挿入（テスト用）

```
mcp__supabase__execute_sql

パラメータ:
- project_id: (プロジェクトID)
- query: |
    INSERT INTO tasks (task_id, text, channel, message_ts, created_by, assignee)
    VALUES (
      'task_test123',
      'テストタスク: データベース接続確認',
      'C01234567',
      '1234567890.123456',
      'U01234567',
      'U01234567'
    )
    RETURNING *;
```

### Step 6: データ取得の確認

```
mcp__supabase__execute_sql

パラメータ:
- project_id: (プロジェクトID)
- query: "SELECT * FROM tasks LIMIT 5;"
```

## 📤 成果物

- ✅ `tasks`テーブルが作成されている
- ✅ 適切なインデックスが設定されている
- ✅ マイグレーションが適用されている
- ✅ サンプルデータの挿入・取得が成功している

## 🔍 確認方法

```bash
# Supabase Studio（ブラウザ）でテーブルを確認
# https://app.supabase.com/project/[PROJECT_ID]/editor

# または、MCPツールで確認
mcp__supabase__list_tables
mcp__supabase__execute_sql (SELECT文で確認)
```

## ⚠️ 注意点

1. **タイムスタンプは`TIMESTAMP WITH TIME ZONE`を使用**
   - ユーザーのタイムゾーンを考慮できる

2. **CHECK制約でデータ整合性を保つ**
   - statusは`open`, `completed`, `cancelled`のみ
   - priorityは1〜3の範囲

3. **将来の拡張を考慮**
   - `tags`（タグ）、`summary`（AI要約）、`priority`（優先度）カラムを追加済み

4. **インデックスの適切な設計**
   - よく検索するカラム（status, assignee, channel）にインデックスを作成
   - WHERE句で絞り込むクエリを高速化

## 🚀 次のステップ

→ [タスク3: データベース接続モジュールの実装](./task-03-database-connection.md)
