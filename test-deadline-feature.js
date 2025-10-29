/**
 * 期限管理機能のテストスクリプト
 *
 * 実行方法:
 * node test-deadline-feature.js
 */

const taskService = require('./src/services/taskService');

async function testDeadlineFeature() {
  console.log('🧪 期限管理機能のテスト開始\n');

  try {
    // 1. 期限付きタスクを作成
    console.log('1️⃣ 期限付きタスクの作成テスト');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(15, 0, 0, 0); // 明日の15:00

    const taskWithDeadline = await taskService.createTask({
      text: 'テスト: 期限付きタスク（明日15時）',
      channel: 'C01234567',
      messageTs: `manual_${Date.now()}`,
      createdBy: 'U01234567',
      assignee: 'U01234567',
      dueDate: tomorrow
    });

    console.log('✅ 期限付きタスク作成成功:', taskWithDeadline.task_id);
    console.log(`   期限: ${new Date(taskWithDeadline.due_date).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);

    // 2. 期限なしタスクを作成（比較用）
    console.log('\n2️⃣ 期限なしタスクの作成テスト');

    const taskWithoutDeadline = await taskService.createTask({
      text: 'テスト: 期限なしタスク',
      channel: 'C01234567',
      messageTs: `manual_${Date.now()}`,
      createdBy: 'U01234567',
      assignee: 'U01234567'
    });

    console.log('✅ 期限なしタスク作成成功:', taskWithoutDeadline.task_id);
    console.log('   期限: なし');

    // 3. タスク一覧を取得
    console.log('\n3️⃣ タスク一覧取得テスト');

    const allTasks = await taskService.getTasks({ status: 'open' });
    console.log(`✅ 未完了タスク数: ${allTasks.length}件`);

    allTasks.forEach(task => {
      console.log(`   - ${task.task_id}: ${task.text.substring(0, 30)}...`);
      if (task.due_date) {
        console.log(`     期限: ${new Date(task.due_date).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
      }
    });

    // 4. 期限が近いタスクを取得（24時間以内）
    console.log('\n4️⃣ 期限が近いタスクの取得テスト（24時間以内）');

    const upcomingTasks = await taskService.getUpcomingTasks(24);
    console.log(`✅ 24時間以内に期限のタスク: ${upcomingTasks.length}件`);

    upcomingTasks.forEach(task => {
      const dueDate = new Date(task.due_date);
      const hoursUntil = Math.round((dueDate - new Date()) / (1000 * 60 * 60));
      console.log(`   - ${task.task_id}: ${task.text.substring(0, 30)}...`);
      console.log(`     期限まであと ${hoursUntil} 時間`);
    });

    // 5. クリーンアップ（テストタスクを削除）
    console.log('\n5️⃣ テストタスクのクリーンアップ');

    await taskService.deleteTask(taskWithDeadline.task_id);
    console.log(`✅ ${taskWithDeadline.task_id} を削除`);

    await taskService.deleteTask(taskWithoutDeadline.task_id);
    console.log(`✅ ${taskWithoutDeadline.task_id} を削除`);

    console.log('\n✅ 全テスト完了！');
    console.log('\n📝 次のステップ:');
    console.log('1. Slack API ダッシュボードでグローバルショートカットを設定');
    console.log('2. アプリを起動: npm start');
    console.log('3. Slackで⚡アイコンから「Create Task with Deadline」を実行');
    console.log('4. モーダルでタスクを作成して動作確認');
    console.log('\n📖 設定方法: docs/SLACK-SHORTCUT-SETUP.md を参照');

  } catch (error) {
    console.error('\n❌ テスト失敗:', error.message);
    process.exit(1);
  }
}

testDeadlineFeature();
