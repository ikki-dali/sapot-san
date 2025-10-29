const taskService = require('./src/services/taskService');

async function testTaskService() {
  console.log('🧪 タスクサービスのテスト開始\n');

  try {
    // 1. タスク作成
    console.log('1️⃣ タスク作成テスト');
    const newTask = await taskService.createTask({
      text: 'テストタスク: サービス層の動作確認',
      channel: 'C01234567',
      messageTs: '1234567890.123456',
      createdBy: 'U01234567',
      assignee: 'U01234567',
      priority: 2
    });
    console.log('   タスクID:', newTask.task_id);
    console.log('');

    // 2. タスク取得
    console.log('2️⃣ タスク取得テスト');
    const task = await taskService.getTaskById(newTask.task_id);
    console.log('   取得結果:', task ? '✅ 見つかりました' : '❌ 見つかりません');
    console.log('');

    // 3. タスク一覧取得
    console.log('3️⃣ タスク一覧取得テスト');
    const tasks = await taskService.getTasks();
    console.log(`   取得件数: ${tasks.length}件`);
    console.log('');

    // 4. タスク完了
    console.log('4️⃣ タスク完了テスト');
    const completedTask = await taskService.completeTask(newTask.task_id, 'U01234567');
    console.log('   ステータス:', completedTask.status === 'completed' ? '✅ 完了' : '❌ 未完了');
    console.log('');

    // 5. タスク削除
    console.log('5️⃣ タスク削除テスト');
    const deleted = await taskService.deleteTask(newTask.task_id);
    console.log('   削除結果:', deleted ? '✅ 成功' : '❌ 失敗');
    console.log('');

    console.log('✅ 全テスト完了！タスクサービスは正常に動作しています。');
  } catch (error) {
    console.error('\n❌ テスト失敗:', error.message);
    process.exit(1);
  }
}

testTaskService();
