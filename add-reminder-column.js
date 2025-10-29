const { supabase } = require('./src/db/connection');

async function addReminderColumn() {
  try {
    console.log('tasksテーブルにlast_reminded_atカラムを追加中...');

    // Supabase SQLエディタで実行するSQLを表示
    const sql = `
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMP;
`;

    console.log('\n以下のSQLをSupabase SQLエディタで実行してください:');
    console.log('---');
    console.log(sql);
    console.log('---');

    console.log('\n実行URL: https://supabase.com/dashboard/project/ogomzppqppjyqbnqests/sql/new');

  } catch (error) {
    console.error('エラー:', error.message);
  }
  process.exit(0);
}

addReminderColumn();
