# タスク13: エラーハンドリングの強化

**フェーズ**: Phase 5 - 品質改善
**難易度**: Medium
**推定時間**: 2時間
**依存関係**: タスク12（ログ管理システムの実装）、タスク5（app.jsのリファクタリング）

## 🎯 目標

全てのイベントハンドラーとサービスに適切なエラーハンドリング、ユーザーへの通知、リトライ機構を実装する。

## 📋 背景

現在のエラーハンドリングは基本的なtry-catchのみです。本番運用では以下が必要です：
- 詳細なエラーログ
- ユーザーへのわかりやすいエラー通知
- リトライ可能なエラーの自動リトライ
- 致命的エラーの適切な処理

## ✅ 実装手順

### チェックリスト
- [ ] エラーハンドリングユーティリティを作成
- [ ] データベースエラーハンドリングを強化
- [ ] Slack APIエラーハンドリングを強化
- [ ] OpenAI APIエラーハンドリングを強化
- [ ] グローバルエラーハンドラーを実装
- [ ] 動作テストを実施

---

### Step 1: エラーハンドリングユーティリティの作成

`src/utils/errorHandler.js`:

```javascript
const logger = require('./logger');

/**
 * エラーの種類を判定
 */
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational; // 運用エラー（想定内）かプログラミングエラーか
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * データベースエラー
 */
class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

/**
 * Slack APIエラー
 */
class SlackAPIError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500);
    this.name = 'SlackAPIError';
    this.originalError = originalError;
  }
}

/**
 * OpenAI APIエラー
 */
class OpenAIError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500);
    this.name = 'OpenAIError';
    this.originalError = originalError;
  }
}

/**
 * エラーハンドラー：エラーをログに記録し、必要に応じてユーザーに通知
 * @param {Error} error - エラーオブジェクト
 * @param {Object} context - コンテキスト情報
 */
function handleError(error, context = {}) {
  const { slackClient, channel, threadTs, userId } = context;

  // エラーログ
  logger.failure(error.message, {
    name: error.name,
    stack: error.stack,
    context: context
  });

  // ユーザーへの通知（Slackクライアントがある場合）
  if (slackClient && channel) {
    notifyUserOfError(slackClient, channel, threadTs, userId, error);
  }

  // 致命的エラーの場合はプロセスを終了
  if (!error.isOperational) {
    logger.error('致命的エラーが発生しました。プロセスを終了します。');
    process.exit(1);
  }
}

/**
 * ユーザーにエラーを通知
 */
async function notifyUserOfError(slackClient, channel, threadTs, userId, error) {
  try {
    const userFriendlyMessage = getUserFriendlyErrorMessage(error);

    if (userId) {
      // 特定ユーザーへのエフェメラルメッセージ
      await slackClient.chat.postEphemeral({
        channel: channel,
        user: userId,
        text: `❌ ${userFriendlyMessage}`
      });
    } else if (threadTs) {
      // スレッドへの返信
      await slackClient.chat.postMessage({
        channel: channel,
        thread_ts: threadTs,
        text: `❌ ${userFriendlyMessage}`
      });
    } else {
      // チャンネルへの投稿
      await slackClient.chat.postMessage({
        channel: channel,
        text: `❌ ${userFriendlyMessage}`
      });
    }
  } catch (notifyError) {
    logger.failure('エラー通知の送信に失敗しました', {
      error: notifyError.message
    });
  }
}

/**
 * ユーザーにわかりやすいエラーメッセージを生成
 */
function getUserFriendlyErrorMessage(error) {
  if (error instanceof DatabaseError) {
    return 'データベースへの接続に失敗しました。しばらく待ってから再度お試しください。';
  }

  if (error instanceof SlackAPIError) {
    return 'Slackとの通信に失敗しました。しばらく待ってから再度お試しください。';
  }

  if (error instanceof OpenAIError) {
    return 'AI処理に失敗しました。タスクは作成されましたが、要約や優先度判定はスキップされました。';
  }

  // デフォルトメッセージ
  return '予期しないエラーが発生しました。管理者に連絡してください。';
}

/**
 * リトライ可能な処理を実行
 * @param {Function} fn - 実行する関数
 * @param {number} maxRetries - 最大リトライ回数
 * @param {number} delay - リトライ間隔（ミリ秒）
 */
async function retryOperation(fn, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      logger.warn(`リトライ ${attempt}/${maxRetries}`, {
        error: error.message
      });

      if (attempt === maxRetries) {
        throw error; // 最後のリトライでも失敗したら例外を投げる
      }

      // 指数バックオフ
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
}

module.exports = {
  AppError,
  DatabaseError,
  SlackAPIError,
  OpenAIError,
  handleError,
  retryOperation
};
```

### Step 2: データベースエラーハンドリングの強化

`src/services/taskService.js`を修正:

```javascript
const { DatabaseError, retryOperation } = require('../utils/errorHandler');
const logger = require('../utils/logger');

async function createTask(taskData) {
  return retryOperation(async () => {
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
          priority: taskData.priority || 2,
          summary: taskData.summary || null,
          status: 'open'
        }])
        .select()
        .single();

      if (error) {
        throw new DatabaseError(
          `タスク作成に失敗しました: ${error.message}`,
          error
        );
      }

      logger.task(`タスク作成: ${taskId}`);
      return data;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        `タスク作成中に予期しないエラーが発生しました: ${error.message}`,
        error
      );
    }
  }, 3, 1000); // 最大3回リトライ、1秒間隔
}
```

### Step 3: Slack APIエラーハンドリングの強化

`app.js`のイベントハンドラーを修正:

```javascript
const { handleError, SlackAPIError } = require('./src/utils/errorHandler');

app.event('reaction_added', async ({ event, client }) => {
  try {
    if (event.reaction === 'white_check_mark' || event.reaction === 'memo') {
      // メッセージの内容を取得
      let result;
      try {
        result = await client.conversations.history({
          channel: event.item.channel,
          latest: event.item.ts,
          limit: 1,
          inclusive: true
        });
      } catch (slackError) {
        throw new SlackAPIError(
          `メッセージ取得に失敗しました: ${slackError.message}`,
          slackError
        );
      }

      const message = result.messages[0];

      // タスク作成処理...
      const newTask = await taskService.createTask({
        text: message.text,
        channel: event.item.channel,
        messageTs: event.item.ts,
        createdBy: event.user,
        assignee: message.user
      });

      // 通知送信
      try {
        await client.chat.postMessage({
          channel: event.item.channel,
          thread_ts: event.item.ts,
          text: `✅ タスクを作成しました！\n\n*タスクID:* ${newTask.task_id}`
        });
      } catch (slackError) {
        throw new SlackAPIError(
          `通知送信に失敗しました: ${slackError.message}`,
          slackError
        );
      }
    }
  } catch (error) {
    handleError(error, {
      slackClient: client,
      channel: event.item.channel,
      threadTs: event.item.ts
    });
  }
});
```

### Step 4: OpenAI APIエラーハンドリングの強化

`src/services/aiService.js`を修正:

```javascript
const { OpenAIError, retryOperation } = require('../utils/errorHandler');
const logger = require('../utils/logger');

async function summarizeThread(messages) {
  return retryOperation(async () => {
    try {
      const threadText = messages
        .map(msg => `[${msg.user}]: ${msg.text}`)
        .join('\n');

      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'あなたはSlackのスレッドを簡潔に要約するアシスタントです。'
          },
          {
            role: 'user',
            content: `以下のSlackスレッドを要約してください:\n\n${threadText}`
          }
        ],
        max_tokens: 300,
        temperature: 0.3
      });

      const summary = response.choices[0].message.content.trim();
      logger.ai(`スレッド要約完了（トークン: ${response.usage.total_tokens}）`);

      return summary;
    } catch (error) {
      // OpenAI特有のエラー処理
      if (error.code === 'insufficient_quota') {
        throw new OpenAIError(
          'OpenAI APIのクォータが不足しています。管理者に連絡してください。',
          error
        );
      } else if (error.code === 'rate_limit_exceeded') {
        throw new OpenAIError(
          'OpenAI APIのレート制限に達しました。しばらく待ってから再試行します。',
          error
        );
      }

      throw new OpenAIError(
        `スレッド要約に失敗しました: ${error.message}`,
        error
      );
    }
  }, 3, 2000); // 最大3回リトライ、2秒間隔（OpenAIはレート制限があるため長めに）
}
```

### Step 5: グローバルエラーハンドラーの実装

`app.js`に追加:

```javascript
const logger = require('./src/utils/logger');

// 未処理の例外をキャッチ
process.on('uncaughtException', (error) => {
  logger.error('未処理の例外が発生しました', {
    error: error.message,
    stack: error.stack
  });

  // グレースフルシャットダウン
  process.exit(1);
});

// 未処理のPromise拒否をキャッチ
process.on('unhandledRejection', (reason, promise) => {
  logger.error('未処理のPromise拒否が発生しました', {
    reason: reason,
    promise: promise
  });

  // グレースフルシャットダウン
  process.exit(1);
});

// SIGTERMシグナル（本番環境での正常終了）
process.on('SIGTERM', () => {
  logger.info('SIGTERMシグナルを受信しました。グレースフルシャットダウンを開始します。');

  // Slackアプリを停止
  app.stop().then(() => {
    logger.info('サポ田さんを正常に停止しました');
    process.exit(0);
  });
});
```

### Step 6: 動作テスト

1. **データベースエラーのテスト**
   ```bash
   # .envのSUPABASE_URLを無効な値に変更
   SUPABASE_URL=https://invalid.supabase.co

   # アプリ起動
   npm start
   # → データベース接続エラーが適切にログ出力される
   ```

2. **Slack APIエラーのテスト**
   ```bash
   # .envのSLACK_BOT_TOKENを無効な値に変更
   # → Slack API呼び出しでエラーが発生し、ユーザーに通知される
   ```

3. **OpenAI APIエラーのテスト**
   ```bash
   # .envのOPENAI_API_KEYを無効な値に変更
   # → AI処理がスキップされ、タスク作成は続行される
   ```

4. **リトライ機構のテスト**
   ```javascript
   // test-retry.js
   const { retryOperation } = require('./src/utils/errorHandler');
   const logger = require('./src/utils/logger');

   let attempts = 0;

   retryOperation(async () => {
     attempts++;
     logger.info(`試行回数: ${attempts}`);

     if (attempts < 3) {
       throw new Error('失敗（リトライします）');
     }

     logger.success('成功！');
   }, 3, 500).catch(error => {
     logger.failure('最大リトライ回数に達しました', { error: error.message });
   });
   ```

## 📤 成果物

- ✅ `errorHandler.js`が実装されている
- ✅ カスタムエラークラスが定義されている
- ✅ 全ての主要処理にエラーハンドリングが追加されている
- ✅ ユーザーにわかりやすいエラー通知が送られる
- ✅ リトライ機構が動作する
- ✅ グローバルエラーハンドラーが実装されている

## 🔍 確認方法

```bash
# エラーハンドリングのテスト
node test-retry.js

# アプリ起動（正常系）
npm start

# ログでエラーハンドリングを確認
# → エラー発生時に詳細なログとユーザー通知
```

## ⚠️ 注意点

1. **エラーの分類**
   - 運用エラー（isOperational=true）: ネットワークエラー、バリデーションエラーなど
   - プログラミングエラー（isOperational=false）: null参照、文法エラーなど

2. **リトライ戦略**
   - データベース: 3回、1秒間隔
   - OpenAI API: 3回、2秒間隔（レート制限を考慮）
   - Slack API: リトライなし（通常は即座に成功または失敗）

3. **ユーザー通知**
   - 技術的な詳細は避ける
   - 次に何をすべきかを示す（「再試行してください」など）

4. **ログレベル**
   - リトライ: warn
   - エラー: error
   - 致命的エラー: error + process.exit()

5. **本番環境**
   - エラー監視サービス（Sentry, Datadogなど）への送信を検討
   - アラート設定（エラー率が閾値を超えたら通知）

## 🚀 次のステップ

→ [タスク14: テストコードの作成](./task-14-testing.md)
