require('dotenv').config();
const { supabase } = require('./src/db/connection');

async function debugUnrepliedMentions() {
  console.log('🔍 未返信メンションのデバッグ開始');

  // 全ての未返信メンションを取得（replied_at is null）
  const { data: unreplied, error } = await supabase
    .from('unreplied_mentions')
    .select('*')
    .is('replied_at', null)
    .order('mentioned_at', { ascending: false });

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`\n📊 未返信メンション: ${unreplied.length}件\n`);

  unreplied.forEach((mention, idx) => {
    console.log(`[${idx + 1}] ID: ${mention.id}`);
    console.log(`    メンション先: ${mention.mentioned_user}`);
    console.log(`    送信者: ${mention.mentioner_user}`);
    console.log(`    チャンネル: ${mention.channel}`);
    console.log(`    メッセージTS: ${mention.message_ts}`);
    console.log(`    内容: ${mention.message_text}`);
    console.log(`    優先度: ${mention.priority}`);
    console.log(`    作成日時: ${mention.mentioned_at}`);
    console.log(`    返信日時: ${mention.replied_at}`);
    console.log(`    自動タスク化: ${mention.auto_tasked}`);
    console.log(`    タスクID: ${mention.task_id}`);
    console.log('');
  });

  // 瀬賀さん関連のメンションを詳しく確認
  console.log('\n🔍 瀬賀さん関連のメンションを確認\n');
  const { data: segaMentions, error: segaError } = await supabase
    .from('unreplied_mentions')
    .select('*')
    .or('mentioned_user.ilike.%sega%,mentioner_user.ilike.%sega%,message_text.ilike.%瀬賀%')
    .order('mentioned_at', { ascending: false })
    .limit(20);

  if (!segaError && segaMentions) {
    console.log(`📊 瀬賀さん関連: ${segaMentions.length}件\n`);
    segaMentions.forEach((mention, idx) => {
      console.log(`[${idx + 1}] ID: ${mention.id}`);
      console.log(`    メンション先: ${mention.mentioned_user}`);
      console.log(`    内容: ${mention.message_text}`);
      console.log(`    返信日時: ${mention.replied_at || '未返信'}`);
      console.log(`    自動タスク化: ${mention.auto_tasked}`);
      console.log('');
    });
  }
}

debugUnrepliedMentions().then(() => {
  console.log('✅ デバッグ完了');
  process.exit(0);
}).catch(err => {
  console.error('❌ エラー:', err);
  process.exit(1);
});
