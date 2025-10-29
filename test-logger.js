require('dotenv').config();
const logger = require('./src/utils/logger');

console.log('🧪 ロガーのテスト開始\n');

// 各ログレベルをテスト
logger.info('これは情報ログです');
logger.warn('これは警告ログです');
logger.error('これはエラーログです');

console.log('');

// カスタムログ関数をテスト
logger.task('タスクを作成しました', { taskId: 'task_123' });
logger.slack('Slackメッセージを送信しました', { channel: 'C123', user: 'U456' });
logger.db('データベースクエリを実行しました', { query: 'SELECT * FROM tasks' });
logger.ai('AI処理が完了しました', { tokens: 245, cost: 0.00012 });
logger.cron('cronジョブを実行しました', { job: 'reminder' });
logger.success('処理が成功しました');
logger.failure('処理が失敗しました', { error: 'Connection timeout' });

console.log('');

// エラーオブジェクトのテスト
try {
  throw new Error('テストエラー');
} catch (error) {
  logger.error('エラーをキャッチしました', { error: error.message, stack: error.stack });
}

console.log('\n✅ テスト完了！\n');
console.log('💡 ログレベルを変更してテスト:');
console.log('  LOG_LEVEL=warn node test-logger.js  (warnとerrorのみ表示)');
console.log('  LOG_LEVEL=error node test-logger.js (errorのみ表示)');
