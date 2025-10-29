# タスク11: AI機能のSlack統合

**フェーズ**: Phase 3 - AI統合
**難易度**: Medium
**推定時間**: 2時間
**依存関係**: タスク10（AIサービス層の実装）、タスク5（app.jsのリファクタリング）

## 🎯 目標

タスク作成時に自動でスレッドを要約し、優先度を判定してタスクに付加する機能を`app.js`に統合する。

## 📋 背景

AI機能を実際のタスク作成フローに組み込むことで、ユーザーは手動で要約や優先度を設定する手間が省けます。リアクション、モーダル両方のタスク作成フローにAI機能を統合します。

## ✅ 実装手順

### チェックリスト
- [ ] `aiService`をインポート
- [ ] リアクションタスク作成にAI機能を追加
- [ ] モーダルタスク作成にAI機能を追加
- [ ] タスク一覧に要約と優先度を表示
- [ ] AI機能のON/OFF設定を追加
- [ ] 動作テストを実施

---

### Step 1: `app.js`に`aiService`をインポート

```javascript
const aiService = require('./src/services/aiService');
```

### Step 2: リアクションタスク作成にAI機能を追加

`app.event('reaction_added')`を修正:

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

      // AI機能: スレッドがあれば要約、優先度判定
      let summary = null;
      let priority = 2; // デフォルト

      try {
        // スレッドのメッセージを取得
        const threadMessages = await aiService.fetchThreadMessages(
          client,
          event.item.channel,
          event.item.ts
        );

        // スレッドが複数メッセージある場合は要約
        if (threadMessages.length > 1) {
          console.log(`🤖 スレッド要約を開始（${threadMessages.length}件のメッセージ）`);
          summary = await aiService.summarizeThread(threadMessages);
        }

        // 優先度を判定
        console.log('🤖 優先度判定を開始');
        priority = await aiService.determinePriority(message.text);
      } catch (aiError) {
        console.error('⚠️ AI処理エラー（タスク作成は続行）:', aiError.message);
      }

      // タスクをデータベースに保存
      const newTask = await taskService.createTask({
        text: message.text,
        channel: event.item.channel,
        messageTs: event.item.ts,
        createdBy: event.user,
        assignee: message.user,
        priority: priority,
        summary: summary
      });

      // タスク作成を通知
      let notificationText = `✅ タスクを作成しました！\n\n*タスクID:* ${newTask.task_id}\n*内容:* ${message.text}\n*担当:* <@${message.user}>\n*優先度:* ${getPriorityEmoji(priority)} ${getPriorityLabel(priority)}`;

      if (summary) {
        notificationText += `\n\n*要約:*\n${summary}`;
      }

      await client.chat.postMessage({
        channel: event.item.channel,
        thread_ts: event.item.ts, // スレッドで返信
        text: notificationText
      });

      console.log(`タスク作成: ${newTask.task_id} (優先度: ${priority})`);
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

// ヘルパー関数: 優先度の絵文字
function getPriorityEmoji(priority) {
  const emojis = {
    1: '🟢', // 低
    2: '🟡', // 中
    3: '🔴'  // 高
  };
  return emojis[priority] || '⚪';
}

// ヘルパー関数: 優先度のラベル
function getPriorityLabel(priority) {
  const labels = {
    1: '低',
    2: '中',
    3: '高'
  };
  return labels[priority] || '中';
}
```

### Step 3: モーダルタスク作成にAI機能を追加

`app.view('task_modal_submit')`を修正:

```javascript
app.view('task_modal_submit', async ({ ack, body, view, client }) => {
  await ack();

  try {
    // フォームから値を取得
    const values = view.state.values;

    const taskText = values.task_text.text_input.value;
    const assignee = values.assignee.assignee_select.selected_user;
    const channel = values.channel.channel_select.selected_channel;
    const dueDate = values.due_date.date_select.selected_date;
    const dueTime = values.due_time.time_select.selected_time;

    // 期限日時を結合
    let dueDateTimestamp = null;
    if (dueDate) {
      if (dueTime) {
        dueDateTimestamp = new Date(`${dueDate}T${dueTime}:00+09:00`);
      } else {
        dueDateTimestamp = new Date(`${dueDate}T23:59:59+09:00`);
      }
    }

    // AI機能: タスク整形と優先度判定
    let formattedText = taskText;
    let priority = 2;

    try {
      console.log('🤖 タスク整形を開始');
      formattedText = await aiService.formatTaskText(taskText);

      console.log('🤖 優先度判定を開始');
      priority = await aiService.determinePriority(formattedText, dueDateTimestamp);
    } catch (aiError) {
      console.error('⚠️ AI処理エラー（タスク作成は続行）:', aiError.message);
    }

    // タスクをデータベースに作成
    const newTask = await taskService.createTask({
      text: formattedText,
      channel: channel,
      messageTs: `manual_${Date.now()}`,
      createdBy: body.user.id,
      assignee: assignee,
      dueDate: dueDateTimestamp,
      priority: priority
    });

    // チャンネルに通知
    let notificationText = `✅ タスクを作成しました！\n\n*タスクID:* ${newTask.task_id}\n*内容:* ${formattedText}\n*担当:* <@${assignee}>\n*優先度:* ${getPriorityEmoji(priority)} ${getPriorityLabel(priority)}`;

    if (dueDateTimestamp) {
      const dueDateStr = dueDateTimestamp.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Tokyo'
      });
      notificationText += `\n*期限:* ${dueDateStr}`;
    }

    await client.chat.postMessage({
      channel: channel,
      text: notificationText
    });

    console.log(`タスク作成（モーダル経由）: ${newTask.task_id} (優先度: ${priority})`);
  } catch (error) {
    console.error('タスク作成エラー（モーダル）:', error);
  }
});
```

### Step 4: タスク一覧に要約と優先度を表示

`/task-list`コマンドを修正:

```javascript
app.command('/task-list', async ({ command, ack, client }) => {
  await ack();

  try {
    // 現在のタスクを取得（優先度でソート）
    const { data: userTasks, error } = await taskService.supabase
      .from('tasks')
      .select('*')
      .eq('status', 'open')
      .order('priority', { ascending: false }) // 優先度高い順
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!userTasks || userTasks.length === 0) {
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: '現在、未完了のタスクはありません！'
      });
      return;
    }

    // タスクリストを整形
    let taskList = '*📋 現在のタスク一覧*\n\n';

    // 優先度ごとにグループ化
    const highPriority = userTasks.filter(t => t.priority === 3);
    const mediumPriority = userTasks.filter(t => t.priority === 2);
    const lowPriority = userTasks.filter(t => t.priority === 1);

    const addTasksToList = (tasks, label) => {
      if (tasks.length > 0) {
        taskList += `*${label}*\n`;
        tasks.forEach(task => {
          const createdDate = new Date(task.created_at).toLocaleDateString('ja-JP');
          taskList += `${getPriorityEmoji(task.priority)} *${task.task_id}*: ${task.text}\n`;
          taskList += `  担当: <@${task.assignee}> | 作成日: ${createdDate}`;

          if (task.due_date) {
            const dueDate = new Date(task.due_date).toLocaleDateString('ja-JP');
            taskList += ` | 期限: ${dueDate}`;
          }

          if (task.summary) {
            taskList += `\n  _要約: ${task.summary.substring(0, 100)}..._`;
          }

          taskList += '\n\n';
        });
      }
    };

    addTasksToList(highPriority, '🔴 優先度: 高');
    addTasksToList(mediumPriority, '🟡 優先度: 中');
    addTasksToList(lowPriority, '🟢 優先度: 低');

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

### Step 5: AI機能のON/OFF設定（環境変数）

`.env`に追加:

```env
# AI機能のON/OFF
AI_ENABLED=true
AI_SUMMARIZE_ENABLED=true
AI_PRIORITY_ENABLED=true
AI_FORMAT_ENABLED=true
```

`app.js`で環境変数をチェック:

```javascript
// AI機能が有効かチェック
const isAIEnabled = process.env.AI_ENABLED === 'true';

// リアクションタスク作成の中で
if (isAIEnabled && process.env.AI_SUMMARIZE_ENABLED === 'true') {
  summary = await aiService.summarizeThread(threadMessages);
}

if (isAIEnabled && process.env.AI_PRIORITY_ENABLED === 'true') {
  priority = await aiService.determinePriority(message.text);
}
```

### Step 6: 動作テスト

1. **リアクションでタスク作成**
   - Slackで複数メッセージのスレッドを作成
   - 最初のメッセージに✅リアクション
   - → 要約と優先度が表示される

2. **モーダルでタスク作成**
   - ショートカット → "Create Task with Deadline"
   - タスク内容: 「緊急！本番環境でエラー発生」
   - → 優先度3（高）と判定される

3. **タスク一覧確認**
   - `/task-list`を実行
   - → 優先度順に表示される

4. **AI機能を無効化してテスト**
   - `.env`で`AI_ENABLED=false`
   - → AI処理がスキップされる

## 📤 成果物

- ✅ リアクションタスク作成でAI機能が動作
- ✅ モーダルタスク作成でAI機能が動作
- ✅ タスク一覧に優先度と要約が表示される
- ✅ AI機能のON/OFF設定が可能
- ✅ エラー時もタスク作成が続行される

## 🔍 確認方法

```bash
# アプリ起動
npm start

# Slackでテスト
# 1. スレッドを作成して✅リアクション
# 2. /task-list で確認
# 3. モーダルで緊急タスクを作成

# ログで確認
# → "🤖 スレッド要約を開始"
# → "🤖 優先度判定を開始"
# → "📝 スレッド要約完了（トークン: xxx）"
```

## ⚠️ 注意点

1. **エラーハンドリング**
   - AI処理が失敗してもタスク作成は続行
   - ユーザーには通知しない（ログのみ）

2. **コスト管理**
   - AI機能はオプション（環境変数でON/OFF）
   - 必要に応じて無効化できる

3. **プライバシー**
   - OpenAIにSlackのメッセージ内容が送信される
   - 機密情報を含むスレッドには注意

4. **パフォーマンス**
   - AI処理は数秒かかる場合がある
   - ack()の後に非同期で実行

5. **優先度の精度**
   - AIの判定は完璧ではない
   - 将来的に手動で変更できる機能を追加

## 🚀 次のステップ

Phase 3（AI統合）完了！

→ [タスク12: ログ管理システムの実装](./task-12-logging-system.md)
