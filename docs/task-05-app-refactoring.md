# タスク5: app.jsのリファクタリング

**フェーズ**: Phase 1 - データベース統合
**難易度**: Medium
**推定時間**: 1.5時間
**依存関係**: タスク4（タスクサービス層の実装）

## 🎯 目標

`app.js`の In-memory Map 操作を `taskService` を使ったデータベース操作に置き換える。

## 📋 背景

現在、`app.js`では`const tasks = new Map()`を使ってメモリ上でタスクを管理しています。これを`taskService`を使ったデータベース操作に完全移行します。

## ✅ 実装手順

### チェックリスト
- [x] `taskService`をインポート
- [x] Mapの宣言を削除
- [x] リアクションイベントハンドラーを修正
- [x] `/task-list`コマンドを修正
- [x] `/task-done`コマンドを修正
- [x] エラーハンドリングを強化
- [x] 動作テストを実施

---

### Step 1: `taskService`のインポート

`app.js`の先頭に追加:

```javascript
require('dotenv').config();
const { App } = require('@slack/bolt');
const { checkConnection } = require('./src/db/connection');
const taskService = require('./src/services/taskService');
```

### Step 2: In-memory Mapの削除

以下の行を削除:
```javascript
// 削除する
const tasks = new Map();
```

### Step 3: リアクションイベントハンドラーの修正

`app.event('reaction_added')`を以下のように修正:

```javascript
app.event('reaction_added', async ({ event, client }) => {
  try {
    // 特定の絵文字（例：✅ :white_check_mark:）でタスク化
    if (event.reaction === 'white_check_mark' || event.reaction === 'memo') {
      // メッセージの内容を取得
      const result = await client.conversations.history({
        channel: event.item.channel,
        latest: event.item.ts,
        limit: 1,
        inclusive: true
      });

      const message = result.messages[0];

      // タスクをデータベースに保存
      const newTask = await taskService.createTask({
        text: message.text,
        channel: event.item.channel,
        messageTs: event.item.ts,
        createdBy: event.user,
        assignee: message.user
      });

      // タスク作成を通知
      await client.chat.postMessage({
        channel: event.item.channel,
        thread_ts: event.item.ts, // スレッドで返信
        text: `✅ タスクを作成しました！\n\n*タスクID:* ${newTask.task_id}\n*内容:* ${message.text}\n*担当:* <@${message.user}>`
      });

      console.log(`タスク作成: ${newTask.task_id}`);
    }
  } catch (error) {
    console.error('タスク作成エラー:', error);

    // エラーをユーザーに通知
    try {
      await client.chat.postMessage({
        channel: event.item.channel,
        thread_ts: event.item.ts,
        text: `❌ タスク作成に失敗しました: ${error.message}`
      });
    } catch (notifyError) {
      console.error('エラー通知失敗:', notifyError);
    }
  }
});
```

### Step 4: `/task-list`コマンドの修正

```javascript
app.command('/task-list', async ({ command, ack, client }) => {
  await ack(); // Slackにコマンドを受け取ったことを即座に通知（3秒以内必須）

  try {
    // 現在のタスクを取得（デフォルトで未完了のみ）
    const userTasks = await taskService.getTasks({
      status: 'open'
    });

    if (userTasks.length === 0) {
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: '現在、未完了のタスクはありません！'
      });
      return;
    }

    // タスクリストを整形
    let taskList = '*📋 現在のタスク一覧*\n\n';
    userTasks.forEach(task => {
      const createdDate = new Date(task.created_at).toLocaleDateString('ja-JP');
      taskList += `• *${task.task_id}*: ${task.text}\n`;
      taskList += `  担当: <@${task.assignee}> | 作成日: ${createdDate}\n`;

      // 期限がある場合は表示
      if (task.due_date) {
        const dueDate = new Date(task.due_date).toLocaleDateString('ja-JP');
        taskList += `  期限: ${dueDate}\n`;
      }

      taskList += '\n';
    });

    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: taskList
    });
  } catch (error) {
    console.error('タスク一覧表示エラー:', error);

    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: `❌ タスク一覧の取得に失敗しました: ${error.message}`
    });
  }
});
```

### Step 5: `/task-done`コマンドの修正

```javascript
app.command('/task-done', async ({ command, ack, client }) => {
  await ack();

  try {
    const taskId = command.text.trim();

    // タスクの存在確認
    const task = await taskService.getTaskById(taskId);

    if (!task) {
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: `❌ タスクID「${taskId}」が見つかりません`
      });
      return;
    }

    // タスクを完了状態に
    await taskService.completeTask(taskId, command.user_id);

    // 元のスレッドに完了通知
    await client.chat.postMessage({
      channel: task.channel,
      thread_ts: task.message_ts,
      text: `🎉 タスクが完了しました！\n*完了者:* <@${command.user_id}>`
    });

    // コマンド実行者にも通知
    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: `✅ タスク「${taskId}」を完了しました`
    });

    console.log(`タスク完了: ${taskId}`);
  } catch (error) {
    console.error('タスク完了エラー:', error);

    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: `❌ タスクの完了処理に失敗しました: ${error.message}`
    });
  }
});
```

### Step 6: アプリ起動時のDB接続確認

```javascript
(async () => {
  // データベース接続確認
  const isDbConnected = await checkConnection();
  if (!isDbConnected) {
    console.error('❌ データベース接続に失敗しました。環境変数を確認してください。');
    process.exit(1);
  }

  await app.start();
  console.log('⚡️ サポ田さんが起動しました！');
})();
```

### Step 7: 動作テスト

1. **アプリケーション起動**
   ```bash
   npm start
   ```

2. **Slackでテスト**
   - メッセージに✅リアクションを追加 → タスクが作成される
   - `/task-list`を実行 → タスク一覧が表示される
   - `/task-done task_xxxxx`を実行 → タスクが完了する

3. **データベース確認**
   ```
   mcp__supabase__execute_sql
   query: "SELECT * FROM tasks ORDER BY created_at DESC LIMIT 10;"
   ```

## 📤 成果物

- ✅ `app.js`がデータベース操作に完全移行
- ✅ In-memory Mapが削除されている
- ✅ 全てのイベント・コマンドが正常動作
- ✅ エラーハンドリングが強化されている
- ✅ アプリ再起動後もタスクが永続化されている

## 🔍 確認方法

```bash
# アプリ起動
npm start

# 別ターミナルでタスク確認
node -e "
  const taskService = require('./src/services/taskService');
  (async () => {
    const tasks = await taskService.getTasks();
    console.log('タスク数:', tasks.length);
  })();
"
```

## ⚠️ 注意点

1. **既存データの移行**
   - In-memoryで作成済みのタスクは失われる
   - 本番環境では移行スクリプトが必要（今回は開発段階なのでOK）

2. **非同期処理のエラーハンドリング**
   - 全てのtry-catchブロックでユーザーへの通知を実装
   - エラーログも必ず出力

3. **Slack APIの3秒ルール**
   - `ack()`は必ず3秒以内に呼ぶ
   - データベース操作は`ack()`の後に実行

4. **期限表示の追加**
   - タスク一覧で期限（due_date）がある場合は表示

## 🚀 次のステップ

Phase 1（データベース統合）完了！

→ [タスク6: 期限管理機能の設計](./task-06-deadline-management.md)
