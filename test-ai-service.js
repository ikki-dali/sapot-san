require('dotenv').config();
const aiService = require('./src/services/aiService');

async function testAIService() {
  console.log('🤖 AIサービステスト開始\n');

  try {
    // =====================================
    // テスト1: スレッド要約
    // =====================================
    console.log('📝 テスト1: スレッド要約');
    console.log('─────────────────────────────────');

    const testMessages = [
      {
        user: 'U001',
        text: 'リマインダー機能のバグを見つけました。期限が過ぎたタスクの通知が来ていません。',
        ts: '1234567890.123456'
      },
      {
        user: 'U002',
        text: 'ログを確認しましたか？cron設定が正しいか確認してください。',
        ts: '1234567891.123456'
      },
      {
        user: 'U001',
        text: 'ログを見たところ、checkOverdueTasks関数が呼ばれていないようです。',
        ts: '1234567892.123456'
      },
      {
        user: 'U002',
        text: 'なるほど。では明日の午前中にcron設定を見直して修正します。',
        ts: '1234567893.123456'
      }
    ];

    const summary = await aiService.summarizeThread(testMessages);
    console.log(`✅ 要約結果:\n${summary}\n`);

    // =====================================
    // テスト2: 優先度判定（緊急タスク）
    // =====================================
    console.log('🎯 テスト2: 優先度判定（緊急タスク）');
    console.log('─────────────────────────────────');

    const urgentTask = 'セキュリティ脆弱性が見つかりました。早急にパッチを適用する必要があります';
    const priority1 = await aiService.determinePriority(urgentTask);
    console.log(`タスク: ${urgentTask}`);
    console.log(`✅ 判定された優先度: ${priority1} (期待値: 1=高)\n`);

    // =====================================
    // テスト3: 優先度判定（通常タスク）
    // =====================================
    console.log('🎯 テスト3: 優先度判定（通常タスク）');
    console.log('─────────────────────────────────');

    const normalTask = 'ドキュメントを更新して、新機能の使い方を説明する';
    const priority2 = await aiService.determinePriority(normalTask);
    console.log(`タスク: ${normalTask}`);
    console.log(`✅ 判定された優先度: ${priority2} (期待値: 2=中 または 3=低)\n`);

    // =====================================
    // テスト4: 優先度判定（期限付きタスク）
    // =====================================
    console.log('🎯 テスト4: 優先度判定（期限付きタスク - 24時間以内）');
    console.log('─────────────────────────────────');

    const taskWithDeadline = 'プレゼン資料を作成する';
    const deadline = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12時間後
    const priority3 = await aiService.determinePriority(taskWithDeadline, deadline);
    console.log(`タスク: ${taskWithDeadline}`);
    console.log(`期限: ${deadline.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
    console.log(`✅ 判定された優先度: ${priority3} (期待値: 1=高)\n`);

    // =====================================
    // テスト5: テキスト整形
    // =====================================
    console.log('✨ テスト5: テキスト整形');
    console.log('─────────────────────────────────');

    const rawText = 'えーっと、あの、明日までに、あのプロジェクトの件でレポートを書かなきゃいけなくて、多分3ページくらい？で、上司に提出する必要があるんですけど';
    const formatted = await aiService.formatTaskText(rawText);
    console.log(`元のテキスト: ${rawText}`);
    console.log(`✅ 整形後: ${formatted}\n`);

    // =====================================
    // テスト6: 担当者提案
    // =====================================
    console.log('👤 テスト6: 担当者提案');
    console.log('─────────────────────────────────');

    const assignee = await aiService.suggestAssignee(testMessages);
    console.log(`✅ 提案された担当者: ${assignee || 'なし'}\n`);

    // =====================================
    // まとめ
    // =====================================
    console.log('═════════════════════════════════');
    console.log('✅ すべてのテストが完了しました！');
    console.log('═════════════════════════════════');
    console.log('\n💡 次のステップ:');
    console.log('  1. app.jsに各AI機能を統合');
    console.log('  2. リアクション作成時に自動要約を追加');
    console.log('  3. モーダル作成時に優先度を自動判定');
    console.log('  4. タスクテキストを自動整形');
  } catch (error) {
    console.error('❌ テストエラー:', error);
    process.exit(1);
  }
}

testAIService();
