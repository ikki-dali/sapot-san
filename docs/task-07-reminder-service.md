# タスク7: リマインダーサービスの実装

**フェーズ**: Phase 2 - 期限管理とリマインド
**難易度**: Complex
**推定時間**: 2.5時間
**依存関係**: タスク6（期限管理機能の設計）

## 🎯 目標

期限が近いタスクを自動で通知する`src/services/reminderService.js`を実装し、node-cronで定期実行する。

## 📋 背景

期限が設定されたタスクを忘れないように、定期的にチェックして通知を送ります。朝の始業時間（例: 9時）や、期限の24時間前などに自動通知することで、タスクの漏れを防ぎます。

## ✅ 実装手順

### チェックリスト
- [ ] `node-cron`をインストール
- [ ] `reminderService.js`を実装
- [ ] 期限チェックロジックを実装
- [ ] Slack通知機能を実装
- [ ] cronジョブを設定
- [ ] `app.js`に統合
- [ ] 動作テストを実施

---

### Step 1: `node-cron`のインストール

```bash
npm install node-cron
```

### Step 2: `src/services/reminderService.js`の実装

```javascript
const cron = require('node-cron');
const taskService = require('./taskService');

/**
 * 期限が近いタスクをチェックして通知を送る
 * @param {Object} slackClient - Slack Boltのclientオブジェクト
 * @param {number} hoursAhead - 何時間後までのタスクを通知するか（デフォルト24時間）
 */
async function checkUpcomingDeadlines(slackClient, hoursAhead = 24) {
  try {
    console.log(`⏰ 期限チェック開始（${hoursAhead}時間以内）`);

    // 期限が近いタスクを取得
    const upcomingTasks = await taskService.getUpcomingTasks(hoursAhead);

    if (upcomingTasks.length === 0) {
      console.log('✅ 期限が近いタスクはありません');
      return;
    }

    console.log(`📋 ${upcomingTasks.length}件のタスクの期限が近づいています`);

    // 各タスクについて通知を送る
    for (const task of upcomingTasks) {
      await sendDeadlineReminder(slackClient, task);
    }

    console.log('✅ 期限通知完了');
  } catch (error) {
    console.error('❌ 期限チェックエラー:', error);
  }
}

/**
 * 期限切れタスクをチェックして通知を送る
 * @param {Object} slackClient - Slack Boltのclientオブジェクト
 */
async function checkOverdueTasks(slackClient) {
  try {
    console.log('🚨 期限切れタスクチェック開始');

    const now = new Date();

    // 期限切れの未完了タスクを取得
    const { data: overdueTasks, error } = await taskService.supabase
      .from('tasks')
      .select('*')
      .eq('status', 'open')
      .lt('due_date', now.toISOString())
      .order('due_date', { ascending: true });

    if (error) throw error;

    if (!overdueTasks || overdueTasks.length === 0) {
      console.log('✅ 期限切れタスクはありません');
      return;
    }

    console.log(`⚠️ ${overdueTasks.length}件の期限切れタスクがあります`);

    // 各タスクについて通知を送る
    for (const task of overdueTasks) {
      await sendOverdueReminder(slackClient, task);
    }

    console.log('✅ 期限切れ通知完了');
  } catch (error) {
    console.error('❌ 期限切れチェックエラー:', error);
  }
}

/**
 * 期限が近いタスクの通知を送信
 * @param {Object} slackClient - Slack Boltのclientオブジェクト
 * @param {Object} task - タスクオブジェクト
 */
async function sendDeadlineReminder(slackClient, task) {
  try {
    const dueDate = new Date(task.due_date);
    const now = new Date();
    const hoursUntilDue = Math.round((dueDate - now) / (1000 * 60 * 60));

    const dueDateStr = dueDate.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    });

    const message = {
      channel: task.channel,
      text: `⏰ *タスクの期限が近づいています*`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⏰ *タスクの期限が近づいています*\n\n*タスクID:* ${task.task_id}\n*内容:* ${task.text}\n*担当:* <@${task.assignee}>\n*期限:* ${dueDateStr}\n*残り時間:* 約${hoursUntilDue}時間`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `完了したら \`/task-done ${task.task_id}\` を実行してください`
            }
          ]
        }
      ]
    };

    // 元のスレッドがあれば返信
    if (task.message_ts && !task.message_ts.startsWith('manual_')) {
      message.thread_ts = task.message_ts;
    }

    await slackClient.chat.postMessage(message);

    console.log(`📨 通知送信: ${task.task_id} (期限まで${hoursUntilDue}時間)`);
  } catch (error) {
    console.error(`❌ 通知送信エラー (${task.task_id}):`, error);
  }
}

/**
 * 期限切れタスクの通知を送信
 * @param {Object} slackClient - Slack Boltのclientオブジェクト
 * @param {Object} task - タスクオブジェクト
 */
async function sendOverdueReminder(slackClient, task) {
  try {
    const dueDate = new Date(task.due_date);
    const now = new Date();
    const daysPastDue = Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24));

    const dueDateStr = dueDate.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    });

    const message = {
      channel: task.channel,
      text: `🚨 *タスクの期限が過ぎています*`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🚨 *タスクの期限が過ぎています*\n\n*タスクID:* ${task.task_id}\n*内容:* ${task.text}\n*担当:* <@${task.assignee}>\n*期限:* ${dueDateStr}\n*経過日数:* ${daysPastDue}日`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `完了したら \`/task-done ${task.task_id}\` を実行してください`
            }
          ]
        }
      ]
    };

    // 元のスレッドがあれば返信
    if (task.message_ts && !task.message_ts.startsWith('manual_')) {
      message.thread_ts = task.message_ts;
    }

    await slackClient.chat.postMessage(message);

    console.log(`📨 期限切れ通知送信: ${task.task_id} (${daysPastDue}日経過)`);
  } catch (error) {
    console.error(`❌ 期限切れ通知送信エラー (${task.task_id}):`, error);
  }
}

/**
 * リマインダーcronジョブを開始
 * @param {Object} slackClient - Slack Boltのclientオブジェクト
 */
function startReminderJobs(slackClient) {
  // 毎日朝9時に期限チェック（24時間以内）
  cron.schedule('0 9 * * *', () => {
    console.log('🔔 [定期実行] 朝のリマインダーチェック');
    checkUpcomingDeadlines(slackClient, 24);
  }, {
    timezone: 'Asia/Tokyo'
  });

  // 毎日夕方18時に期限切れチェック
  cron.schedule('0 18 * * *', () => {
    console.log('🔔 [定期実行] 期限切れタスクチェック');
    checkOverdueTasks(slackClient);
  }, {
    timezone: 'Asia/Tokyo'
  });

  // 開発・テスト用: 1時間ごとに実行（本番では削除推奨）
  // cron.schedule('0 * * * *', () => {
  //   console.log('🔔 [定期実行] 1時間ごとのチェック');
  //   checkUpcomingDeadlines(slackClient, 24);
  // }, {
  //   timezone: 'Asia/Tokyo'
  // });

  console.log('✅ リマインダーcronジョブを開始しました');
  console.log('  - 毎日 9:00: 期限が近いタスク通知');
  console.log('  - 毎日 18:00: 期限切れタスク通知');
}

module.exports = {
  checkUpcomingDeadlines,
  checkOverdueTasks,
  sendDeadlineReminder,
  sendOverdueReminder,
  startReminderJobs
};
```

### Step 3: `app.js`に統合

```javascript
// app.js の先頭に追加
const reminderService = require('./src/services/reminderService');

// アプリ起動処理に追加
(async () => {
  // データベース接続確認
  const isDbConnected = await checkConnection();
  if (!isDbConnected) {
    console.error('❌ データベース接続に失敗しました。環境変数を確認してください。');
    process.exit(1);
  }

  await app.start();
  console.log('⚡️ サポ田さんが起動しました！');

  // リマインダーcronジョブを開始
  reminderService.startReminderJobs(app.client);
})();
```

### Step 4: 手動テスト用コマンドの追加（オプション）

テスト用に手動でリマインダーを実行できるコマンドを追加:

```javascript
// 管理者用: 手動でリマインダーをテスト
app.command('/reminder-test', async ({ command, ack, client }) => {
  await ack();

  try {
    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: '⏰ リマインダーチェックを手動実行します...'
    });

    // 24時間以内の期限タスクをチェック
    await reminderService.checkUpcomingDeadlines(client, 24);

    // 期限切れタスクをチェック
    await reminderService.checkOverdueTasks(client);

    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: '✅ リマインダーチェック完了'
    });
  } catch (error) {
    console.error('リマインダーテストエラー:', error);
    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: `❌ エラー: ${error.message}`
    });
  }
});
```

### Step 5: 動作テスト

1. **テスト用のタスクを作成**
   ```javascript
   // test-reminder.js
   const taskService = require('./src/services/taskService');

   (async () => {
     // 2時間後に期限のタスクを作成
     const futureDate = new Date();
     futureDate.setHours(futureDate.getHours() + 2);

     await taskService.createTask({
       text: 'テスト: リマインダー確認',
       channel: 'C01234567', // 実際のチャンネルID
       messageTs: `manual_${Date.now()}`,
       createdBy: 'U01234567', // 実際のユーザーID
       assignee: 'U01234567',
       dueDate: futureDate
     });

     console.log('✅ テストタスク作成完了');
   })();
   ```

2. **手動でリマインダーを実行**
   ```bash
   # Slackで実行
   /reminder-test
   ```

3. **cron実行時刻を変更してテスト**
   ```javascript
   // reminderService.jsで、テスト用に1分ごとに実行
   cron.schedule('* * * * *', () => {
     checkUpcomingDeadlines(slackClient, 24);
   });
   ```

## 📤 成果物

- ✅ `src/services/reminderService.js`が実装されている
- ✅ `node-cron`で定期実行される
- ✅ 期限が近いタスクを自動通知
- ✅ 期限切れタスクを自動通知
- ✅ 手動テストコマンドが動作する

## 🔍 確認方法

```bash
# アプリ起動
npm start

# ログで確認
# → "✅ リマインダーcronジョブを開始しました" と表示される

# 手動テスト
/reminder-test （Slackで実行）

# cronの実行を確認（9:00または18:00に自動実行される）
```

## ⚠️ 注意点

1. **タイムゾーンの指定**
   - `timezone: 'Asia/Tokyo'`で日本時間を明示
   - サーバーのタイムゾーンに依存しない

2. **cron構文**
   ```
   * * * * *
   │ │ │ │ │
   │ │ │ │ └─ 曜日 (0-7) (0または7=日曜日)
   │ │ │ └─── 月 (1-12)
   │ │ └───── 日 (1-31)
   │ └─────── 時 (0-23)
   └───────── 分 (0-59)
   ```

3. **本番環境での調整**
   - 通知頻度を調整（1日2回 → 1日1回など）
   - テスト用の1時間ごと実行は削除

4. **通知の重複回避**
   - 同じタスクに何度も通知しないよう、最終通知時刻を記録する機能を追加することも検討

5. **エラーハンドリング**
   - cronジョブ内のエラーはアプリ全体を止めないようにtry-catchで囲む

## 🚀 次のステップ

Phase 2（期限管理とリマインド）完了！

→ [タスク8: 未返信メッセージ検知機能](./task-08-unreplied-detection.md)
