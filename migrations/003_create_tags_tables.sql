-- タグマスターテーブル
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  color VARCHAR(7) DEFAULT '#6c757d',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- タスクとタグの中間テーブル
CREATE TABLE IF NOT EXISTS task_tags (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id, tag_id)
);

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id);

-- デフォルトタグを挿入
INSERT INTO tags (name, color) VALUES
  ('緊急', '#dc3545'),
  ('重要', '#fd7e14'),
  ('バグ', '#e83e8c'),
  ('機能追加', '#0d6efd'),
  ('改善', '#20c997'),
  ('質問', '#6f42c1'),
  ('レビュー待ち', '#ffc107')
ON CONFLICT (name) DO NOTHING;
