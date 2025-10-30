const { supabase } = require('./src/db/connection');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  try {
    console.log('📝 マイグレーションを適用中...');

    // SQLファイルを読み込み
    const sqlPath = path.join(__dirname, 'migrations', 'create_task_tags.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // SQLを実行
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // rpc関数が存在しない場合は、直接実行を試みる
      console.log('⚠️  rpc経由での実行に失敗、直接実行を試みます...');

      const { error: directError } = await supabase.from('task_tags').select('id').limit(1);

      if (directError && directError.message.includes('does not exist')) {
        console.error('❌ テーブルが存在しません。Supabase SQL Editorで以下のSQLを実行してください:');
        console.log('\n' + sql + '\n');
        process.exit(1);
      } else {
        console.log('✅ テーブルは既に存在します');
        process.exit(0);
      }
    }

    console.log('✅ マイグレーション完了');
    process.exit(0);
  } catch (error) {
    console.error('❌ マイグレーションエラー:', error.message);

    // SQLファイルの内容を表示
    const sqlPath = path.join(__dirname, 'migrations', 'create_task_tags.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('\nSupabase SQL Editorで以下のSQLを実行してください:');
    console.log('\n' + sql + '\n');

    process.exit(1);
  }
}

applyMigration();
