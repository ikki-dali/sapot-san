/**
 * 既存タスクのメンションIDをユーザー名に変換するマイグレーションスクリプト
 */

const { App } = require('@slack/bolt');
const { supabase } = require('./src/db/connection');
const { replaceMentionsWithNames } = require('./src/utils/helpers');
require('dotenv').config();

// Slack Appを初期化
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

async function migrateTaskMentions() {
  console.log('🔄 メンションID変換マイグレーションを開始します...\n');

  try {
    // 全てのタスクを取得（完了済みも含む）
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, task_id, text')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    console.log(`📊 合計 ${tasks.length} 件のタスクを処理します\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const task of tasks) {
      // メンションIDが含まれているかチェック
      const hasMention = /<@[A-Z0-9]+>/.test(task.text) || /<!subteam\^[A-Z0-9]+/.test(task.text);

      if (!hasMention) {
        skippedCount++;
        continue;
      }

      console.log(`🔄 処理中: ${task.task_id}`);
      console.log(`   元のテキスト: ${task.text.substring(0, 80)}...`);

      try {
        // メンションIDをユーザー名に変換
        const newText = await replaceMentionsWithNames(task.text, app.client);

        // データベースを更新
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ text: newText })
          .eq('id', task.id);

        if (updateError) {
          throw updateError;
        }

        console.log(`   新しいテキスト: ${newText.substring(0, 80)}...`);
        console.log(`   ✅ 更新完了\n`);
        updatedCount++;

        // レート制限対策：少し待機
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        console.error(`   ❌ エラー: ${err.message}\n`);
        errorCount++;
      }
    }

    console.log('\n📊 マイグレーション完了！');
    console.log(`   ✅ 更新: ${updatedCount} 件`);
    console.log(`   ⏭️  スキップ: ${skippedCount} 件`);
    console.log(`   ❌ エラー: ${errorCount} 件`);

  } catch (error) {
    console.error('❌ マイグレーションエラー:', error);
    process.exit(1);
  }

  process.exit(0);
}

// 実行
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('   タスクメンションID変換マイグレーション');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

migrateTaskMentions();
