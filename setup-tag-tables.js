/**
 * タグテーブルとタスクタグ中間テーブルを作成するスクリプト
 */

require('dotenv').config();
const { supabase } = require('./src/db/connection');

async function setupTagTables() {
  console.log('📦 タグテーブルを作成します...\n');

  try {
    // 1. tagsテーブルを作成
    console.log('1️⃣ tagsテーブルを作成中...');
    const { error: tagsError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS tags (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          color VARCHAR(7) DEFAULT '#6c757d',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `
    });

    if (tagsError && !tagsError.message.includes('already exists')) {
      console.error('❌ tagsテーブル作成エラー:', tagsError.message);
    } else {
      console.log('✅ tagsテーブル作成完了');
    }

    // 2. task_tagsテーブルを作成
    console.log('2️⃣ task_tagsテーブルを作成中...');
    const { error: taskTagsError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS task_tags (
          id SERIAL PRIMARY KEY,
          task_id VARCHAR(255) NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
          tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(task_id, tag_id)
        );
      `
    });

    if (taskTagsError && !taskTagsError.message.includes('already exists')) {
      console.error('❌ task_tagsテーブル作成エラー:', taskTagsError.message);
    } else {
      console.log('✅ task_tagsテーブル作成完了');
    }

    // 3. インデックスを作成
    console.log('3️⃣ インデックスを作成中...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags(task_id);
        CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id);
      `
    });

    if (indexError) {
      console.error('⚠️ インデックス作成エラー（既に存在する可能性）:', indexError.message);
    } else {
      console.log('✅ インデックス作成完了');
    }

    // 4. サンプルタグを挿入
    console.log('4️⃣ サンプルタグを挿入中...');
    const sampleTags = [
      { name: '緊急', color: '#dc3545' },
      { name: '開発', color: '#0d6efd' },
      { name: '営業', color: '#198754' },
      { name: '重要', color: '#ffc107' }
    ];

    for (const tag of sampleTags) {
      const { error: insertError } = await supabase
        .from('tags')
        .insert([tag])
        .select();

      if (insertError && !insertError.message.includes('duplicate')) {
        console.error(`⚠️ タグ "${tag.name}" 挿入エラー:`, insertError.message);
      } else if (!insertError) {
        console.log(`✅ タグ "${tag.name}" を作成しました`);
      }
    }

    console.log('\n🎉 タグテーブルのセットアップが完了しました！\n');
    console.log('これで以下の機能が使えるようになります：');
    console.log('  - タスクにタグを追加');
    console.log('  - タグでタスクをフィルタリング');
    console.log('  - タグ別の統計表示\n');

  } catch (error) {
    console.error('❌ セットアップエラー:', error.message);
    console.log('\n手動でテーブルを作成する必要があります。');
    console.log('Supabase Dashboard > SQL Editorで以下を実行してください:\n');
    console.log(getSQLScript());
    process.exit(1);
  }

  process.exit(0);
}

function getSQLScript() {
  return `
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

-- RLSポリシー: tags（全員が読み取り可能）
CREATE POLICY IF NOT EXISTS "tags_select_policy" ON tags
  FOR SELECT
  USING (true);

-- RLSポリシー: tags（全員が挿入可能）
CREATE POLICY IF NOT EXISTS "tags_insert_policy" ON tags
  FOR INSERT
  WITH CHECK (true);

-- RLSポリシー: task_tags（全員が読み取り可能）
CREATE POLICY IF NOT EXISTS "task_tags_select_policy" ON task_tags
  FOR SELECT
  USING (true);

-- RLSポリシー: task_tags（全員が挿入・削除可能）
CREATE POLICY IF NOT EXISTS "task_tags_insert_policy" ON task_tags
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "task_tags_delete_policy" ON task_tags
  FOR DELETE
  USING (true);

-- サンプルタグを挿入
INSERT INTO tags (name, color) VALUES
  ('緊急', '#dc3545'),
  ('開発', '#0d6efd'),
  ('営業', '#198754'),
  ('重要', '#ffc107')
ON CONFLICT (name) DO NOTHING;
`;
}

// 実行
setupTagTables();
