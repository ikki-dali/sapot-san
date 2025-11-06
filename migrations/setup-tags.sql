-- タグテーブル
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  color VARCHAR(7) DEFAULT '#6c757d',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- タスクとタグの中間テーブル
CREATE TABLE IF NOT EXISTS task_tags (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id, tag_id)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id);

-- RLSを有効化
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "tags_select_policy" ON tags;
DROP POLICY IF EXISTS "tags_insert_policy" ON tags;
DROP POLICY IF EXISTS "tags_update_policy" ON tags;
DROP POLICY IF EXISTS "tags_delete_policy" ON tags;
DROP POLICY IF EXISTS "task_tags_select_policy" ON task_tags;
DROP POLICY IF EXISTS "task_tags_insert_policy" ON task_tags;
DROP POLICY IF EXISTS "task_tags_delete_policy" ON task_tags;

-- RLSポリシー: tags（全員が読み取り可能）
CREATE POLICY "tags_select_policy" ON tags
  FOR SELECT
  USING (true);

-- RLSポリシー: tags（全員が挿入可能）
CREATE POLICY "tags_insert_policy" ON tags
  FOR INSERT
  WITH CHECK (true);

-- RLSポリシー: tags（全員が更新可能）
CREATE POLICY "tags_update_policy" ON tags
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- RLSポリシー: tags（全員が削除可能）
CREATE POLICY "tags_delete_policy" ON tags
  FOR DELETE
  USING (true);

-- RLSポリシー: task_tags（全員が読み取り可能）
CREATE POLICY "task_tags_select_policy" ON task_tags
  FOR SELECT
  USING (true);

-- RLSポリシー: task_tags（全員が挿入可能）
CREATE POLICY "task_tags_insert_policy" ON task_tags
  FOR INSERT
  WITH CHECK (true);

-- RLSポリシー: task_tags（全員が削除可能）
CREATE POLICY "task_tags_delete_policy" ON task_tags
  FOR DELETE
  USING (true);

-- サンプルタグを挿入
INSERT INTO tags (name, color) VALUES
  ('緊急', '#dc3545'),
  ('開発', '#0d6efd'),
  ('営業', '#198754'),
  ('重要', '#ffc107')
ON CONFLICT (name) DO NOTHING;
