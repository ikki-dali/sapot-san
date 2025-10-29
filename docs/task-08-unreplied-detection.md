# タスク8: 未返信メッセージ検知機能

**フェーズ**: Phase 4 - 未返信メッセージ検知
**難易度**: Complex
**推定時間**: 3時間
**依存関係**: タスク5（app.jsのリファクタリング）

## 🎯 目標

メンションされたが24時間以上返信がないメッセージを検知し、自動的にタスク化する機能を実装する。

## 📋 背景

Slackで依頼を受けたが、忙しくて返信を忘れてしまうケースを防ぎます。サポ田さんにメンションされたメッセージをトラッキングし、一定時間返信がなければ自動でタスク化します。

## ✅ 実装手順

### チェックリスト
- [ ] 未返信追跡テーブルを作成
- [ ] `app_mention`イベントで未返信を記録
- [ ] `message`イベントで返信を検知
- [ ] 定期的に未返信をチェックする処理を実装
- [ ] 自動タスク化機能を実装
- [ ] ON/OFF設定機能を追加（オプション）
- [ ] 動作テストを実施

---

### Step 1: 未返信追跡テーブルの作成

Supabaseにマイグレーションを適用:

```sql
-- 未返信メッセージ追跡テーブル
CREATE TABLE IF NOT EXISTS unreplied_mentions (
  id BIGSERIAL PRIMARY KEY,
  channel VARCHAR(255) NOT NULL,
  message_ts VARCHAR(255) NOT NULL,
  mentioned_user VARCHAR(255) NOT NULL,
  mentioner_user VARCHAR(255) NOT NULL,
  message_text TEXT NOT NULL,
  mentioned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  replied_at TIMESTAMP WITH TIME ZONE,
  auto_tasked BOOLEAN DEFAULT FALSE,
  task_id VARCHAR(255),
  UNIQUE(channel, message_ts, mentioned_user)
);

-- インデックス
CREATE INDEX idx_unreplied_channel ON unreplied_mentions(channel);
CREATE INDEX idx_unreplied_user ON unreplied_mentions(mentioned_user);
CREATE INDEX idx_unreplied_status ON unreplied_mentions(replied_at) WHERE replied_at IS NULL;

COMMENT ON TABLE unreplied_mentions IS 'メンションされたが未返信のメッセージを追跡';
```

MCPツールで実行:
```
mcp__supabase__apply_migration
パラメータ:
- project_id: (プロジェクトID)
- name: "create_unreplied_mentions_table"
- query: (上記のSQL)
```

### Step 2: `src/services/unrepliedService.js`の実装

```javascript
const { supabase } = require('../db/connection');
const taskService = require('./taskService');

/**
 * メンションを記録
 * @param {Object} mentionData - メンションデータ
 */
async function recordMention(mentionData) {
  try {
    const { data, error } = await supabase
      .from('unreplied_mentions')
      .insert([{
        channel: mentionData.channel,
        message_ts: mentionData.messageTs,
        mentioned_user: mentionData.mentionedUser,
        mentioner_user: mentionData.mentionerUser,
        message_text: mentionData.text
      }])
      .select()
      .single();

    if (error) {
      // 既存のメンション（重複）は無視
      if (error.code === '23505') { // unique_violation
        console.log('既存のメンション（スキップ）');
        return null;
      }
      throw error;
    }

    console.log(`📝 メンション記録: ${mentionData.channel}/${mentionData.messageTs}`);
    return data;
  } catch (error) {
    console.error('❌ メンション記録エラー:', error.message);
    throw error;
  }
}

/**
 * 返信を記録（未返信状態を解除）
 * @param {string} channel - チャンネルID
 * @param {string} threadTs - スレッドのタイムスタンプ
 * @param {string} userId - 返信したユーザーID
 */
async function markAsReplied(channel, threadTs, userId) {
  try {
    const { data, error } = await supabase
      .from('unreplied_mentions')
      .update({
        replied_at: new Date().toISOString()
      })
      .eq('channel', channel)
      .eq('message_ts', threadTs)
      .eq('mentioned_user', userId)
      .is('replied_at', null);

    if (error) throw error;

    if (data && data.length > 0) {
      console.log(`✅ 返信記録: ${channel}/${threadTs}`);
    }

    return data;
  } catch (error) {
    console.error('❌ 返信記録エラー:', error.message);
    throw error;
  }
}

/**
 * 未返信メッセージを取得
 * @param {number} hoursThreshold - 何時間以上未返信のものを取得するか
 */
async function getUnrepliedMentions(hoursThreshold = 24) {
  try {
    const thresholdTime = new Date();
    thresholdTime.setHours(thresholdTime.getHours() - hoursThreshold);

    const { data, error } = await supabase
      .from('unreplied_mentions')
      .select('*')
      .is('replied_at', null)
      .eq('auto_tasked', false)
      .lt('mentioned_at', thresholdTime.toISOString())
      .order('mentioned_at', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('❌ 未返信メッセージ取得エラー:', error.message);
    throw error;
  }
}

/**
 * 未返信メッセージを自動的にタスク化
 * @param {Object} mention - メンションオブジェクト
 */
async function autoCreateTask(mention) {
  try {
    // タスクを作成
    const newTask = await taskService.createTask({
      text: `【未返信】${mention.message_text}`,
      channel: mention.channel,
      messageTs: mention.message_ts,
      createdBy: 'auto_system',
      assignee: mention.mentioned_user
    });

    // 未返信記録を更新
    await supabase
      .from('unreplied_mentions')
      .update({
        auto_tasked: true,
        task_id: newTask.task_id
      })
      .eq('id', mention.id);

    console.log(`✅ 自動タスク化: ${newTask.task_id}`);
    return newTask;
  } catch (error) {
    console.error('❌ 自動タスク化エラー:', error.message);
    throw error;
  }
}

/**
 * 未返信メッセージを定期チェックして自動タスク化
 * @param {Object} slackClient - Slack Boltのclientオブジェクト
 * @param {number} hoursThreshold - 何時間以上未返信のものを対象にするか
 */
async function checkAndAutoTaskUnreplied(slackClient, hoursThreshold = 24) {
  try {
    console.log(`🔍 未返信メッセージチェック開始（${hoursThreshold}時間以上）`);

    const unreplied = await getUnrepliedMentions(hoursThreshold);

    if (unreplied.length === 0) {
      console.log('✅ 未返信メッセージはありません');
      return;
    }

    console.log(`📋 ${unreplied.length}件の未返信メッセージを発見`);

    for (const mention of unreplied) {
      // 自動タスク化
      const task = await autoCreateTask(mention);

      // Slackに通知
      await slackClient.chat.postMessage({
        channel: mention.channel,
        thread_ts: mention.message_ts,
        text: `⚠️ 24時間以上返信がないため、自動的にタスク化しました。\n\n*タスクID:* ${task.task_id}\n*担当:* <@${mention.mentioned_user}>\n\n完了したら \`/task-done ${task.task_id}\` を実行してください。`
      });

      console.log(`📨 自動タスク化通知送信: ${task.task_id}`);
    }

    console.log('✅ 未返信チェック完了');
  } catch (error) {
    console.error('❌ 未返信チェックエラー:', error);
  }
}

module.exports = {
  recordMention,
  markAsReplied,
  getUnrepliedMentions,
  autoCreateTask,
  checkAndAutoTaskUnreplied
};
```

### Step 3: `app.js`にイベントハンドラーを追加

```javascript
const unrepliedService = require('./src/services/unrepliedService');

// app_mentionイベントを修正（メンション記録を追加）
app.event('app_mention', async ({ event, client }) => {
  try {
    // メンションを記録
    await unrepliedService.recordMention({
      channel: event.channel,
      messageTs: event.ts,
      mentionedUser: event.user, // メンションされたのはボット自身ではなく、メンションを受けたユーザー
      mentionerUser: event.user,
      text: event.text
    });

    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.ts,
      text: `こんにちは！サポ田さんです 👋\n\nタスク管理のお手伝いをします！\n• ✅ や :memo: のリアクションでタスク作成\n• \`/task-list\` でタスク一覧表示\n• \`/task-done [タスクID]\` でタスク完了\n\n24時間以上返信がない場合、自動的にタスク化します。`
    });
  } catch (error) {
    console.error('メンション応答エラー:', error);
  }
});

// スレッド内のメッセージを検知（返信を記録）
app.event('message', async ({ event }) => {
  try {
    // スレッド返信のみを対象
    if (event.thread_ts && event.thread_ts !== event.ts) {
      await unrepliedService.markAsReplied(
        event.channel,
        event.thread_ts,
        event.user
      );
    }
  } catch (error) {
    console.error('メッセージ処理エラー:', error);
  }
});
```

### Step 4: cronジョブに未返信チェックを追加

`src/services/reminderService.js`に追加:

```javascript
const unrepliedService = require('./unrepliedService');

function startReminderJobs(slackClient) {
  // 既存のcronジョブ...

  // 毎日午前10時に未返信チェック（24時間以上）
  cron.schedule('0 10 * * *', () => {
    console.log('🔔 [定期実行] 未返信メッセージチェック');
    unrepliedService.checkAndAutoTaskUnreplied(slackClient, 24);
  }, {
    timezone: 'Asia/Tokyo'
  });

  console.log('✅ リマインダーcronジョブを開始しました');
  console.log('  - 毎日 9:00: 期限が近いタスク通知');
  console.log('  - 毎日 10:00: 未返信メッセージ自動タスク化');
  console.log('  - 毎日 18:00: 期限切れタスク通知');
}
```

### Step 5: 動作テスト

1. **サポ田さんにメンション**
   ```
   @サポ田さん これお願いします
   ```

2. **24時間待たずにテスト（手動実行）**
   ```javascript
   // test-unreplied.js
   const unrepliedService = require('./src/services/unrepliedService');
   const { App } = require('@slack/bolt');

   // Slack clientを初期化
   const app = new App({
     token: process.env.SLACK_BOT_TOKEN,
     signingSecret: process.env.SLACK_SIGNING_SECRET
   });

   (async () => {
     // 1時間以上未返信のメッセージをチェック（テスト用）
     await unrepliedService.checkAndAutoTaskUnreplied(app.client, 0.01); // 0.01時間 = 36秒
   })();
   ```

3. **スレッドに返信してテスト**
   - メンションしたスレッドに返信
   - データベースで`replied_at`が更新されることを確認

4. **データベース確認**
   ```
   mcp__supabase__execute_sql
   query: "SELECT * FROM unreplied_mentions ORDER BY mentioned_at DESC LIMIT 10;"
   ```

## 📤 成果物

- ✅ `unreplied_mentions`テーブルが作成されている
- ✅ メンション時に自動記録される
- ✅ スレッド返信時に返信状態が更新される
- ✅ 24時間以上未返信のメッセージが自動タスク化される
- ✅ 定期チェックが動作している

## 🔍 確認方法

```bash
# アプリ起動
npm start

# Slackでメンション
@サポ田さん テストメッセージ

# データベース確認
node -e "
  const { supabase } = require('./src/db/connection');
  (async () => {
    const { data } = await supabase.from('unreplied_mentions').select('*');
    console.log('未返信記録:', data.length, '件');
  })();
"

# 手動でチェック実行
node test-unreplied.js
```

## ⚠️ 注意点

1. **ボット自身のメンションの扱い**
   - `app_mention`イベントはボット宛のメンションを検知
   - 実際のユースケースに応じて、誰がメンションされたかを正しく記録

2. **スレッド返信の検知**
   - `message`イベントで`thread_ts`があれば返信と判定
   - ボット自身の投稿は除外する処理を追加推奨

3. **重複防止**
   - UNIQUE制約で同じメッセージへの重複記録を防止

4. **自動タスク化のON/OFF**
   - ユーザーごとに自動タスク化を無効化できる設定を追加することも検討
   - 環境変数`AUTO_TASK_ENABLED=true/false`で制御

5. **通知のタイミング**
   - 24時間は調整可能（12時間、48時間など）
   - チーム文化に合わせて設定

## 🚀 次のステップ

Phase 4（未返信メッセージ検知）完了！

→ [タスク9: OpenAI API統合の準備](./task-09-openai-setup.md)
