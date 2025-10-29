/**
 * Remindersテーブル作成マイグレーション実行スクリプト
 *
 * 実行方法:
 * node migrations/create_reminders_table.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase クライアント作成
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function runMigration() {
  try {
    console.log('🚀 Remindersテーブルのマイグレーションを開始します...');

    // SQLファイルを読み込み
    const sqlPath = path.join(__dirname, '004_create_reminders_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('📄 SQLファイルを読み込みました');
    console.log('---');
    console.log(sql);
    console.log('---');

    // マイグレーション実行
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sql
    });

    if (error) {
      // RPC関数がない場合は、Supabase Dashboardで直接実行する必要があることを通知
      if (error.message.includes('exec_sql')) {
        console.log('⚠️  RPC関数 "exec_sql" が見つかりません。');
        console.log('');
        console.log('📋 以下の手順で手動実行してください:');
        console.log('');
        console.log('1. Supabase Dashboard (https://supabase.com/dashboard) にアクセス');
        console.log('2. プロジェクトを選択');
        console.log('3. 左サイドバーから "SQL Editor" を選択');
        console.log('4. "New query" をクリック');
        console.log('5. 上記のSQLをコピー＆ペースト');
        console.log('6. "Run" をクリック');
        console.log('');
        console.log('または、以下のコマンドでSupabase CLIを使用:');
        console.log(`supabase db push --file ${sqlPath}`);
        console.log('');
        return;
      }

      throw error;
    }

    console.log('✅ マイグレーション成功！');
    console.log('');

    // テーブルが作成されたか確認
    const { data: tables, error: checkError } = await supabase
      .from('reminders')
      .select('*')
      .limit(0);

    if (checkError) {
      console.log('⚠️  テーブル確認エラー:', checkError.message);
      console.log('テーブルは作成されましたが、アクセス権限の確認が必要かもしれません。');
    } else {
      console.log('✅ remindersテーブルが正常に作成されました！');
    }

    console.log('');
    console.log('📊 次のステップ:');
    console.log('1. Phase 2: 情報検索機能の実装');
    console.log('2. Phase 3: リマインド機能の実装');

  } catch (error) {
    console.error('❌ マイグレーション失敗:', error.message);
    console.error('詳細:', error);
    process.exit(1);
  }
}

// 実行
runMigration();
