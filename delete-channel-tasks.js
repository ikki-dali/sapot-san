/**
 * 削除されたチャンネルのタスクとメンションを削除するスクリプト
 */

require('dotenv').config();
const { supabase } = require('./src/db/connection');

const DELETED_CHANNEL_ID = 'C09D8QYCYN8';

async function deleteChannelData() {
  console.log(`📦 チャンネル ${DELETED_CHANNEL_ID} のデータを削除します...\n`);

  try {
    // 1. タスクを削除
    console.log('1️⃣ タスクを削除中...');
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('channel', DELETED_CHANNEL_ID)
      .select();

    if (tasksError) {
      console.error('❌ タスク削除エラー:', tasksError.message);
    } else {
      console.log(`✅ タスク削除完了: ${tasks?.length || 0}件`);
    }

    // 2. 未返信メンションを削除
    console.log('2️⃣ 未返信メンションを削除中...');
    const { data: mentions, error: mentionsError } = await supabase
      .from('unreplied_mentions')
      .delete()
      .eq('channel', DELETED_CHANNEL_ID)
      .select();

    if (mentionsError) {
      console.error('❌ 未返信メンション削除エラー:', mentionsError.message);
    } else {
      console.log(`✅ 未返信メンション削除完了: ${mentions?.length || 0}件`);
    }

    console.log('\n🎉 削除完了！');

  } catch (error) {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

// 実行
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`   削除されたチャンネルのデータクリーンアップ`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

deleteChannelData();
