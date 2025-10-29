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
