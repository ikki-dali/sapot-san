const winston = require('winston');
const path = require('path');

// ログレベル: error > warn > info > http > verbose > debug > silly
const logLevel = process.env.LOG_LEVEL || 'info';

// カスタムフォーマット
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // スタックトレースがあれば追加
    if (stack) {
      log += `\n${stack}`;
    }

    // 追加メタデータがあれば追加
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }

    return log;
  })
);

// ログの出力先設定
const transports = [
  // コンソール出力（開発環境）
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(), // 色付け
      customFormat
    )
  })
];

// 本番環境ではファイルにも出力（Vercel以外）
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  // エラーログファイル
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.json()
      )
    })
  );

  // 全ログファイル
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      format: winston.format.combine(
        winston.format.json()
      )
    })
  );
}

// ロガーの作成
const logger = winston.createLogger({
  level: logLevel,
  transports: transports,
  // 未処理のエラーをキャッチ（Vercel以外）
  exceptionHandlers: (process.env.NODE_ENV === 'production' && !process.env.VERCEL) ? [
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/exceptions.log')
    })
  ] : [],
  rejectionHandlers: (process.env.NODE_ENV === 'production' && !process.env.VERCEL) ? [
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/rejections.log')
    })
  ] : [],
  // 開発環境では例外でプロセスを終了しない
  exitOnError: false
});

// ヘルパー関数: 絵文字付きログ
logger.task = (message, meta = {}) => {
  logger.info(`📋 ${message}`, meta);
};

logger.slack = (message, meta = {}) => {
  logger.info(`💬 ${message}`, meta);
};

logger.db = (message, meta = {}) => {
  logger.info(`🗄️ ${message}`, meta);
};

logger.ai = (message, meta = {}) => {
  logger.info(`🤖 ${message}`, meta);
};

logger.cron = (message, meta = {}) => {
  logger.info(`⏰ ${message}`, meta);
};

logger.success = (message, meta = {}) => {
  logger.info(`✅ ${message}`, meta);
};

logger.failure = (message, meta = {}) => {
  logger.error(`❌ ${message}`, meta);
};

module.exports = logger;
