const { supabase } = require('./src/db/connection');

async function checkDuplicateTasks() {
  try {
    // task_1761649252497 を検索
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('task_id', 'task_1761649252497');

    if (error) throw error;

    console.log(`\n検索結果: ${tasks.length}件`);
    tasks.forEach((task, index) => {
      console.log(`\n=== タスク ${index + 1} ===`);
      console.log('ID:', task.id);
      console.log('task_id:', task.task_id);
      console.log('内容:', task.text);
      console.log('ステータス:', task.status);
      console.log('期限:', task.due_date);
      console.log('作成日:', task.created_at);
    });

    // すべてのオープンタスクを取得
    const { data: allTasks, error: allError } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'open');

    if (allError) throw allError;

    console.log('\n全オープンタスク数:', allTasks?.length || 0);

  } catch (error) {
    console.error('エラー:', error.message);
  }
  process.exit(0);
}

checkDuplicateTasks();
