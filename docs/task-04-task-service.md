# タスク4: タスクサービス層の実装

**フェーズ**: Phase 1 - データベース統合
**難易度**: Complex
**推定時間**: 2時間
**依存関係**: タスク3（データベース接続モジュール）

## 🎯 目標

タスクのCRUD操作（作成、読み込み、更新、削除）を行う`src/services/taskService.js`を実装する。

## 📋 背景

現在In-memory Mapで管理しているタスク操作を、Supabaseデータベースを使った永続的な操作に置き換えます。

## ✅ 実装手順

### チェックリスト
- [x] `src/services`ディレクトリを作成
- [x] `taskService.js`を実装（CRUD操作）
- [x] エラーハンドリングを追加
- [x] 各関数の単体テストを実行

---

### Step 1: ディレクトリ構造の作成

```bash
mkdir -p src/services
```

### Step 2: `src/services/taskService.js`の実装

```javascript
const { supabase } = require('../db/connection');

/**
 * 新しいタスクを作成
 * @param {Object} taskData - タスクデータ
 * @param {string} taskData.text - タスク内容
 * @param {string} taskData.channel - SlackチャンネルID
 * @param {string} taskData.messageTs - Slackメッセージタイムスタンプ
 * @param {string} taskData.createdBy - 作成者のSlackユーザーID
 * @param {string} taskData.assignee - 担当者のSlackユーザーID
 * @param {Date} [taskData.dueDate] - 期限（オプション）
 * @returns {Promise<Object>} 作成されたタスク
 */
async function createTask(taskData) {
  try {
    const taskId = `task_${Date.now()}`;

    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        task_id: taskId,
        text: taskData.text,
        channel: taskData.channel,
        message_ts: taskData.messageTs,
        created_by: taskData.createdBy,
        assignee: taskData.assignee,
        due_date: taskData.dueDate || null,
        status: 'open'
      }])
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ タスク作成: ${taskId}`);
    return data;
  } catch (error) {
    console.error('❌ タスク作成エラー:', error.message);
    throw error;
  }
}

/**
 * タスクIDでタスクを取得
 * @param {string} taskId - タスクID
 * @returns {Promise<Object|null>} タスクオブジェクト
 */
async function getTaskById(taskId) {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('task_id', taskId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`❌ タスク取得エラー (${taskId}):`, error.message);
    throw error;
  }
}

/**
 * 未完了タスクの一覧を取得
 * @param {Object} [filters] - フィルター条件
 * @param {string} [filters.assignee] - 担当者で絞り込み
 * @param {string} [filters.channel] - チャンネルで絞り込み
 * @param {string} [filters.status='open'] - ステータスで絞り込み
 * @returns {Promise<Array>} タスク配列
 */
async function getTasks(filters = {}) {
  try {
    let query = supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    // フィルター適用
    if (filters.status) {
      query = query.eq('status', filters.status);
    } else {
      query = query.eq('status', 'open'); // デフォルトは未完了のみ
    }

    if (filters.assignee) {
      query = query.eq('assignee', filters.assignee);
    }

    if (filters.channel) {
      query = query.eq('channel', filters.channel);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('❌ タスク一覧取得エラー:', error.message);
    throw error;
  }
}

/**
 * タスクを完了状態にする
 * @param {string} taskId - タスクID
 * @param {string} completedBy - 完了者のSlackユーザーID
 * @returns {Promise<Object>} 更新されたタスク
 */
async function completeTask(taskId, completedBy) {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: completedBy
      })
      .eq('task_id', taskId)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ タスク完了: ${taskId}`);
    return data;
  } catch (error) {
    console.error(`❌ タスク完了エラー (${taskId}):`, error.message);
    throw error;
  }
}

/**
 * タスクを更新（汎用）
 * @param {string} taskId - タスクID
 * @param {Object} updates - 更新するフィールド
 * @returns {Promise<Object>} 更新されたタスク
 */
async function updateTask(taskId, updates) {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('task_id', taskId)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ タスク更新: ${taskId}`);
    return data;
  } catch (error) {
    console.error(`❌ タスク更新エラー (${taskId}):`, error.message);
    throw error;
  }
}

/**
 * タスクを削除
 * @param {string} taskId - タスクID
 * @returns {Promise<boolean>} 削除成功ならtrue
 */
async function deleteTask(taskId) {
  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('task_id', taskId);

    if (error) throw error;

    console.log(`✅ タスク削除: ${taskId}`);
    return true;
  } catch (error) {
    console.error(`❌ タスク削除エラー (${taskId}):`, error.message);
    throw error;
  }
}

/**
 * 期限が近いタスクを取得（リマインダー用）
 * @param {number} hoursAhead - 何時間後までのタスクを取得するか
 * @returns {Promise<Array>} タスク配列
 */
async function getUpcomingTasks(hoursAhead = 24) {
  try {
    const now = new Date();
    const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'open')
      .gte('due_date', now.toISOString())
      .lte('due_date', future.toISOString())
      .order('due_date', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('❌ 期限近タスク取得エラー:', error.message);
    throw error;
  }
}

module.exports = {
  createTask,
  getTaskById,
  getTasks,
  completeTask,
  updateTask,
  deleteTask,
  getUpcomingTasks
};
```

### Step 3: 各関数のテスト

テストスクリプト`test-task-service.js`を作成:

```javascript
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
      assignee: 'U01234567'
    });
    console.log('✅ タスク作成成功:', newTask.task_id);

    // 2. タスク取得
    console.log('\n2️⃣ タスク取得テスト');
    const task = await taskService.getTaskById(newTask.task_id);
    console.log('✅ タスク取得成功:', task ? '見つかりました' : '見つかりません');

    // 3. タスク一覧取得
    console.log('\n3️⃣ タスク一覧取得テスト');
    const tasks = await taskService.getTasks();
    console.log(`✅ タスク一覧取得成功: ${tasks.length}件`);

    // 4. タスク完了
    console.log('\n4️⃣ タスク完了テスト');
    const completedTask = await taskService.completeTask(newTask.task_id, 'U01234567');
    console.log('✅ タスク完了成功:', completedTask.status === 'completed' ? 'OK' : 'NG');

    // 5. タスク削除
    console.log('\n5️⃣ タスク削除テスト');
    const deleted = await taskService.deleteTask(newTask.task_id);
    console.log('✅ タスク削除成功:', deleted ? 'OK' : 'NG');

    console.log('\n✅ 全テスト完了！');
  } catch (error) {
    console.error('\n❌ テスト失敗:', error.message);
    process.exit(1);
  }
}

testTaskService();
```

実行:
```bash
node test-task-service.js
```

## 📤 成果物

- ✅ `src/services/taskService.js`が実装されている
- ✅ CRUD操作（作成、取得、更新、完了、削除）が動作する
- ✅ `getUpcomingTasks()`で期限近タスクを取得できる
- ✅ 各関数にエラーハンドリングが実装されている
- ✅ テストスクリプトで動作確認済み

## 🔍 確認方法

```bash
# テストスクリプトを実行
node test-task-service.js

# 出力例:
# ✅ タスク作成: task_1234567890
# ✅ タスク取得成功
# ✅ タスク一覧取得成功: 5件
# ✅ タスク完了成功
# ✅ タスク削除成功
```

## ⚠️ 注意点

1. **トランザクション処理**
   - Supabaseは自動的にACIDトランザクションを保証
   - 複数テーブル操作が必要な場合はPostgreSQL関数を使用

2. **エラーコードの確認**
   - `PGRST116`: データが見つからない（正常な場合もある）
   - その他のエラーは適切にハンドリング

3. **タイムスタンプの扱い**
   - JavaScriptの`Date`オブジェクトは自動的にISO 8601形式に変換される
   - タイムゾーン情報も保持される

4. **NULL値の扱い**
   - `dueDate`などのオプショナルフィールドは`null`を許容

## 🚀 次のステップ

→ [タスク5: app.jsのリファクタリング](./task-05-app-refactoring.md)
