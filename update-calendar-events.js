/**
 * 既存のGoogle Calendarイベントを更新するスクリプト
 * 全タスクを再同期して「サポットさん」→「サポ田さん」に更新
 */

require('dotenv').config();
const googleCalendarService = require('./src/services/googleCalendarService');
const logger = require('./src/utils/logger');

async function updateAllCalendarEvents() {
  try {
    logger.info('既存のカレンダーイベントを更新開始...');

    if (!googleCalendarService.isCalendarEnabled()) {
      logger.warn('Google Calendar連携が無効です');
      return;
    }

    const syncCount = await googleCalendarService.syncAllTasksToCalendar();

    logger.success(`カレンダーイベント更新完了: ${syncCount}件`, {
      syncCount
    });

    console.log(`\n✅ ${syncCount}件のカレンダーイベントを更新しました`);
    console.log('Google Calendarで「[サポ田さん]」と表示されるはずです');

    process.exit(0);
  } catch (error) {
    logger.failure('カレンダーイベント更新エラー', {
      error: error.message
    });
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }
}

// 実行
updateAllCalendarEvents();
