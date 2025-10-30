require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY are required in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTagTables() {
  console.log('Supabase Dashboard でタグテーブルを作成する必要があります。');
  console.log('\n以下のSQLをSupabase Dashboard > SQL Editorで実行してください:\n');
  console.log(`
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

-- サンプルタグを挿入
INSERT INTO tags (name, color) VALUES
  ('緊急', '#dc3545'),
  ('開発', '#0d6efd'),
  ('営業', '#198754'),
  ('重要', '#ffc107')
ON CONFLICT (name) DO NOTHING;
  `);
  
  console.log('\nSupabase Dashboard URL:');
  console.log(supabaseUrl.replace('.supabase.co', '.supabase.co/project/_/sql'));
}

createTagTables();
