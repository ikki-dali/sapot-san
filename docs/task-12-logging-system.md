# タスク12: ログ管理システムの実装

**フェーズ**: Phase 5 - 品質改善
**難易度**: Simple
**推定時間**: 1時間
**依存関係**: なし（並行実行可能）

## 🎯 目標

適切なログレベル（info, warn, error）とログフォーマットを持つ`src/utils/logger.js`を実装する。

## 📋 背景

現在`console.log`で直接ログ出力していますが、本番環境では以下が必要です：
- ログレベルの分類（info, warn, error）
- タイムスタンプの自動付与
- 構造化ログ（JSON形式）
- ログファイルへの出力（本番環境）
- 外部ログサービスへの送信（将来）

## ✅ 実装手順

### チェックリスト
- [ ] `winston`をインストール
- [ ] `logger.js`を実装
- [ ] ログレベルとフォーマットを設定
- [ ] 既存の`console.log`を置き換え
- [ ] 動作テストを実施

---

### Step 1: `winston`のインストール

```bash
npm install winston
```

### Step 2: `src/utils/logger.js`の実装

```javascript
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

// 本番環境ではファイルにも出力
if (process.env.NODE_ENV === 'production') {
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
  // 未処理のエラーをキャッチ
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/exceptions.log')
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/rejections.log')
    })
  ]
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
```

### Step 3: ログディレクトリの作成

```bash
mkdir -p logs
```

`.gitignore`に追加:

```
# ログファイル
logs/
*.log
```

### Step 4: 既存の`console.log`を置き換え

#### app.js

```javascript
// 変更前
console.log('⚡️ サポ田さんが起動しました！');
console.log(`タスク作成: ${taskId}`);
console.error('タスク作成エラー:', error);

// 変更後
const logger = require('./src/utils/logger');

logger.success('サポ田さんが起動しました！');
logger.task(`タスク作成: ${taskId}`);
logger.failure('タスク作成エラー', { error: error.message, stack: error.stack });
```

#### taskService.js

```javascript
const logger = require('../utils/logger');

// 変更前
console.log(`✅ タスク作成: ${taskId}`);
console.error('❌ タスク作成エラー:', error.message);

// 変更後
logger.task(`タスク作成: ${taskId}`);
logger.failure('タスク作成エラー', { taskId, error: error.message });
```

#### aiService.js

```javascript
const logger = require('../utils/logger');

// 変更前
console.log(`📝 スレッド要約完了（トークン: ${tokensUsed}）`);
console.error('❌ スレッド要約エラー:', error.message);

// 変更後
logger.ai(`スレッド要約完了（トークン: ${tokensUsed}）`);
logger.failure('スレッド要約エラー', { error: error.message });
```

#### reminderService.js

```javascript
const logger = require('../utils/logger');

// 変更前
console.log('⏰ 期限チェック開始（24時間以内）');
console.log('✅ 期限通知完了');

// 変更後
logger.cron('期限チェック開始（24時間以内）');
logger.success('期限通知完了');
```

### Step 5: 環境変数の追加

`.env`に追加:

```env
# ログ設定
LOG_LEVEL=info
NODE_ENV=development
```

本番環境では:

```env
LOG_LEVEL=warn
NODE_ENV=production
```

### Step 6: テストスクリプトの作成

`test-logger.js`:

```javascript
const logger = require('./src/utils/logger');

console.log('🧪 ロガーのテスト開始\n');

// 各ログレベルをテスト
logger.info('これは情報ログです');
logger.warn('これは警告ログです');
logger.error('これはエラーログです');

// カスタムログ関数をテスト
logger.task('タスクを作成しました', { taskId: 'task_123' });
logger.slack('Slackメッセージを送信しました', { channel: 'C123', user: 'U456' });
logger.db('データベースクエリを実行しました', { query: 'SELECT * FROM tasks' });
logger.ai('AI処理が完了しました', { tokens: 245, cost: 0.00012 });
logger.cron('cronジョブを実行しました', { job: 'reminder' });
logger.success('処理が成功しました');
logger.failure('処理が失敗しました', { error: 'Connection timeout' });

// エラーオブジェクトのテスト
try {
  throw new Error('テストエラー');
} catch (error) {
  logger.error('エラーをキャッチしました', { error: error.message, stack: error.stack });
}

console.log('\n✅ テスト完了！');
```

実行:
```bash
node test-logger.js
```

### Step 7: ログローテーション（オプション）

大量のログが生成される場合、ログローテーションを設定:

```bash
npm install winston-daily-rotate-file
```

`logger.js`に追加:

```javascript
const DailyRotateFile = require('winston-daily-rotate-file');

// 本番環境でローテーションファイル追加
if (process.env.NODE_ENV === 'production') {
  transports.push(
    new DailyRotateFile({
      filename: 'logs/sapot-san-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m', // 最大20MB
      maxFiles: '14d' // 14日間保持
    })
  );
}
```

## 📤 成果物

- ✅ `src/utils/logger.js`が実装されている
- ✅ `winston`がインストールされている
- ✅ ログレベル（info, warn, error）が使い分けられている
- ✅ タイムスタンプが自動付与される
- ✅ 本番環境ではファイルにも出力される
- ✅ 既存の`console.log`が置き換えられている

## 🔍 確認方法

```bash
# テストスクリプトを実行
node test-logger.js

# 出力例:
# 2025-01-28 10:30:45 [INFO]: これは情報ログです
# 2025-01-28 10:30:45 [WARN]: これは警告ログです
# 2025-01-28 10:30:45 [ERROR]: これはエラーログです
# 2025-01-28 10:30:45 [INFO]: 📋 タスクを作成しました
# {
#   "taskId": "task_123"
# }

# アプリを起動してログ確認
npm start

# 本番環境でファイル出力確認
NODE_ENV=production npm start
ls logs/
# → error.log, combined.log, exceptions.log が生成される
```

## ⚠️ 注意点

1. **ログレベルの使い分け**
   - `info`: 通常の動作（タスク作成、cronジョブ実行など）
   - `warn`: 警告（AI処理失敗だがタスク作成は続行、など）
   - `error`: エラー（タスク作成失敗、データベース接続失敗など）

2. **機密情報の除外**
   - APIキー、トークンはログに出力しない
   - ユーザーのメッセージ内容は必要最小限に

3. **本番環境での設定**
   - `LOG_LEVEL=warn`でinfoログを抑制
   - ファイル出力を有効化
   - ログローテーションで容量管理

4. **パフォーマンス**
   - ログ出力は非同期処理
   - 大量のログは避ける（ループ内での過度なログなど）

5. **外部サービス連携（将来）**
   - CloudWatch, Datadog, LogglyなどのトランスポートをWinstonに追加可能

## 🚀 次のステップ

→ [タスク13: エラーハンドリングの強化](./task-13-error-handling.md)
