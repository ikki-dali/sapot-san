require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testTableCreation() {
  try {
    console.log('🔍 tasksテーブルの確認中...\n');

    // テーブルからデータを取得（空でもOK）
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .limit(1);

    if (error) {
      throw error;
    }

    console.log('✅ tasksテーブルが正常に作成されています！');
    console.log(`   現在のタスク数: ${data.length}件`);
    console.log('');
    console.log('📋 テーブル構造:');
    console.log('   - id (自動採番)');
    console.log('   - task_id (タスクID)');
    console.log('   - text (タスク内容)');
    console.log('   - channel (Slackチャンネル)');
    console.log('   - status (ステータス: open/completed/cancelled)');
    console.log('   - priority (優先度: 1=低, 2=中, 3=高)');
    console.log('   - assignee (担当者)');
    console.log('   - due_date (期限)');
    console.log('   - summary (AI要約)');
    console.log('   - その他のメタデータ');
    console.log('');
    console.log('🚀 次のステップ: データベース接続モジュールを実装します');

  } catch (error) {
    console.error('❌ エラー:', error.message);
    console.log('');
    console.log('💡 ヒント:');
    console.log('   Supabase SQL Editorでマイグレーションを実行しましたか？');
    console.log('   migrations/001_create_tasks_table.sql の内容を実行してください。');
  }
}

testTableCreation();
