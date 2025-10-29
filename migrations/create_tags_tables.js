const { supabase } = require('../src/db/connection');

async function runMigration() {
  console.log('🔧 タグテーブルのマイグレーション開始...');

  try {
    // タグマスターテーブル作成
    const { error: tagsError } = await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });

    if (tagsError) {
      console.error('❌ テーブル作成エラー:', tagsError);
      throw tagsError;
    }

    console.log('✅ テーブル作成成功');

    // デフォルトタグを挿入
    const defaultTags = [
      { name: '緊急', color: '#dc3545' },
      { name: '重要', color: '#fd7e14' },
      { name: 'バグ', color: '#e83e8c' },
      { name: '機能追加', color: '#0d6efd' },
      { name: '改善', color: '#20c997' },
      { name: '質問', color: '#6f42c1' },
      { name: 'レビュー待ち', color: '#ffc107' }
    ];

    for (const tag of defaultTags) {
      const { error: insertError } = await supabase
        .from('tags')
        .upsert(tag, { onConflict: 'name' });

      if (insertError) {
        console.error(`⚠️ タグ挿入エラー (${tag.name}):`, insertError.message);
      } else {
        console.log(`✅ タグ挿入: ${tag.name}`);
      }
    }

    console.log('✅ マイグレーション完了');
    process.exit(0);
  } catch (error) {
    console.error('❌ マイグレーションエラー:', error);
    process.exit(1);
  }
}

runMigration();
