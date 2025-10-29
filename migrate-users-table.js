require('dotenv').config();
const { supabase } = require('./src/db/connection');
const fs = require('fs');

async function migrateUsersTable() {
  try {
    console.log('📋 usersテーブルのマイグレーションを開始します...');

    // SQLファイルを読み込む
    const sql = fs.readFileSync('./create-users-table.sql', 'utf8');

    // SQLを実行（RPCエンドポイントを使用）
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // RPCエンドポイントがない場合は、直接クエリを実行
      console.log('⚠️ RPC経由でのマイグレーションに失敗しました。');
      console.log('📝 以下のSQLをSupabaseダッシュボードのSQL Editorで実行してください:');
      console.log('https://supabase.com/dashboard/project/ogomzppqppjyqbnqests/sql/new');
      console.log('\n' + sql + '\n');
      return false;
    }

    console.log('✅ usersテーブルのマイグレーションが完了しました！');
    return true;
  } catch (error) {
    console.error('❌ マイグレーションエラー:', error.message);
    console.log('📝 以下のSQLをSupabaseダッシュボードのSQL Editorで実行してください:');
    console.log('https://supabase.com/dashboard/project/ogomzppqppjyqbnqests/sql/new');
    const sql = fs.readFileSync('./create-users-table.sql', 'utf8');
    console.log('\n' + sql + '\n');
    return false;
  }
}

migrateUsersTable();
