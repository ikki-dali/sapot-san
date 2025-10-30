/**
 * Google Calendar連携サービス（マルチユーザー対応）
 * 各ユーザーのOAuthトークンを使用してカレンダーイベントを管理
 */
const { google } = require('googleapis');
const logger = require('../utils/logger');
const googleCalendarOAuthService = require('./googleCalendarOAuthService');
// taskServiceは循環依存を避けるため、使用箇所で遅延読み込み

/**
 * Google Calendar OAuth連携が有効かチェック
 * @returns {boolean}
 */
function isCalendarEnabled() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * タスクをGoogle Calendarイベントとして作成
 * @param {Object} task - タスクオブジェクト
 * @returns {Promise<Object|null>} 作成されたイベント
 */
async function createCalendarEvent(task) {
  try {
    if (!isCalendarEnabled()) {
      logger.debug('Google Calendar連携が無効です');
      return null;
    }

    if (!task.due_date) {
      logger.debug('期限がないタスクはカレンダーに追加されません', {
        taskId: task.task_id
      });
      return null;
    }

    if (!task.assignee) {
      logger.debug('担当者が設定されていません', {
        taskId: task.task_id
      });
      return null;
    }

    // 担当者の認証済みOAuth2クライアントを取得
    const oauth2Client = await googleCalendarOAuthService.getAuthenticatedClient(task.assignee);

    if (!oauth2Client) {
      logger.debug('担当者がGoogleカレンダー連携していません', {
        assignee: task.assignee,
        taskId: task.task_id
      });
      return null;
    }

    // カレンダークライアントを作成
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // ユーザーのカレンダーIDを取得（デフォルトはprimary）
    const tokenData = await googleCalendarOAuthService.getUserTokens(task.assignee);
    const calendarId = tokenData?.calendar_id || 'primary';

    // 優先度に応じた色を設定
    const colorMap = {
      1: '11', // 赤（高優先度）
      2: '5',  // 黄色（中優先度）
      3: '2'   // 緑（低優先度）
    };

    const dueDate = new Date(task.due_date);
    const endDate = new Date(dueDate.getTime() + 60 * 60 * 1000); // 1時間後

    const event = {
      summary: `[サポ田さん] ${task.text}`,
      description: `タスクID: ${task.task_id}\n担当: ${task.assignee}\n優先度: ${task.priority === 1 ? '高' : task.priority === 2 ? '中' : '低'}\n\nSlackチャンネル: ${task.channel}`,
      start: {
        dateTime: dueDate.toISOString(),
        timeZone: 'Asia/Tokyo'
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'Asia/Tokyo'
      },
      colorId: colorMap[task.priority] || '5',
      extendedProperties: {
        private: {
          taskId: task.task_id,
          source: 'sapota-san'
        }
      }
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event
    });

    logger.success('Google Calendarイベント作成', {
      taskId: task.task_id,
      eventId: response.data.id,
      assignee: task.assignee
    });

    return response.data;
  } catch (error) {
    logger.failure('Google Calendarイベント作成エラー', {
      taskId: task.task_id,
      error: error.message
    });
    return null;
  }
}

/**
 * タスクIDでGoogle Calendarイベントを検索
 * @param {string} taskId - タスクID
 * @param {string} slackUserId - SlackユーザーID
 * @returns {Promise<Object|null>} イベントまたはnull
 */
async function findEventByTaskId(taskId, slackUserId) {
  try {
    if (!isCalendarEnabled()) return null;

    const oauth2Client = await googleCalendarOAuthService.getAuthenticatedClient(slackUserId);
    if (!oauth2Client) return null;

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const tokenData = await googleCalendarOAuthService.getUserTokens(slackUserId);
    const calendarId = tokenData?.calendar_id || 'primary';

    const response = await calendar.events.list({
      calendarId,
      privateExtendedProperty: `taskId=${taskId}`,
      maxResults: 1
    });

    if (response.data.items && response.data.items.length > 0) {
      return response.data.items[0];
    }

    return null;
  } catch (error) {
    logger.failure('Google Calendarイベント検索エラー', {
      taskId,
      slackUserId,
      error: error.message
    });
    return null;
  }
}

/**
 * Google Calendarイベントを更新
 * @param {Object} task - タスクオブジェクト
 * @returns {Promise<Object|null>} 更新されたイベント
 */
async function updateCalendarEvent(task) {
  try {
    if (!isCalendarEnabled()) return null;

    if (!task.assignee) return null;

    if (!task.due_date) {
      // 期限がない場合は既存イベントを削除
      await deleteCalendarEvent(task.task_id, task.assignee);
      return null;
    }

    const oauth2Client = await googleCalendarOAuthService.getAuthenticatedClient(task.assignee);
    if (!oauth2Client) return null;

    const existingEvent = await findEventByTaskId(task.task_id, task.assignee);

    if (!existingEvent) {
      // イベントが存在しない場合は新規作成
      return await createCalendarEvent(task);
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const tokenData = await googleCalendarOAuthService.getUserTokens(task.assignee);
    const calendarId = tokenData?.calendar_id || 'primary';

    const colorMap = {
      1: '11', // 赤
      2: '5',  // 黄色
      3: '2'   // 緑
    };

    const dueDate = new Date(task.due_date);
    const endDate = new Date(dueDate.getTime() + 60 * 60 * 1000);

    const updatedEvent = {
      summary: `[サポ田さん] ${task.text}`,
      description: `タスクID: ${task.task_id}\n担当: ${task.assignee}\n優先度: ${task.priority === 1 ? '高' : task.priority === 2 ? '中' : '低'}\n状態: ${task.status === 'completed' ? '完了' : '未完了'}\n\nSlackチャンネル: ${task.channel}`,
      start: {
        dateTime: dueDate.toISOString(),
        timeZone: 'Asia/Tokyo'
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'Asia/Tokyo'
      },
      colorId: task.status === 'completed' ? '8' : colorMap[task.priority] || '5', // 完了時はグレー
      extendedProperties: {
        private: {
          taskId: task.task_id,
          source: 'sapota-san',
          status: task.status
        }
      }
    };

    const response = await calendar.events.update({
      calendarId,
      eventId: existingEvent.id,
      requestBody: updatedEvent
    });

    logger.success('Google Calendarイベント更新', {
      taskId: task.task_id,
      eventId: response.data.id
    });

    return response.data;
  } catch (error) {
    logger.failure('Google Calendarイベント更新エラー', {
      taskId: task.task_id,
      error: error.message
    });
    return null;
  }
}

/**
 * Google Calendarイベントを削除
 * @param {string} taskId - タスクID
 * @param {string} slackUserId - SlackユーザーID
 * @returns {Promise<boolean>} 削除成功ならtrue
 */
async function deleteCalendarEvent(taskId, slackUserId) {
  try {
    if (!isCalendarEnabled()) return false;

    const oauth2Client = await googleCalendarOAuthService.getAuthenticatedClient(slackUserId);
    if (!oauth2Client) return false;

    const existingEvent = await findEventByTaskId(taskId, slackUserId);

    if (!existingEvent) {
      logger.debug('削除するイベントが見つかりません', { taskId, slackUserId });
      return false;
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const tokenData = await googleCalendarOAuthService.getUserTokens(slackUserId);
    const calendarId = tokenData?.calendar_id || 'primary';

    await calendar.events.delete({
      calendarId,
      eventId: existingEvent.id
    });

    logger.success('Google Calendarイベント削除', {
      taskId,
      eventId: existingEvent.id
    });

    return true;
  } catch (error) {
    logger.failure('Google Calendarイベント削除エラー', {
      taskId,
      slackUserId,
      error: error.message
    });
    return false;
  }
}

/**
 * タスク完了時にイベントを更新（完了マーク）
 * @param {string} taskId - タスクID
 * @returns {Promise<Object|null>} 更新されたイベント
 */
async function markEventAsCompleted(taskId) {
  try {
    if (!isCalendarEnabled()) return null;

    // 循環依存を避けるため、ここで遅延読み込み
    const taskService = require('./taskService');
    const task = await taskService.getTaskById(taskId);
    if (!task) {
      logger.warn('タスクが見つかりません', { taskId });
      return null;
    }

    return await updateCalendarEvent(task);
  } catch (error) {
    logger.failure('イベント完了マークエラー', {
      taskId,
      error: error.message
    });
    return null;
  }
}

/**
 * 全タスクをGoogle Calendarに同期
 * @returns {Promise<number>} 同期したタスク数
 */
async function syncAllTasksToCalendar() {
  try {
    if (!isCalendarEnabled()) {
      logger.debug('Google Calendar連携が無効です');
      return 0;
    }

    logger.info('全タスクをGoogle Calendarに同期開始');

    // 循環依存を避けるため、ここで遅延読み込み
    const taskService = require('./taskService');

    // 期限があるタスクのみ取得
    const allTasks = await taskService.getTasks({});
    const tasksWithDeadline = allTasks.filter(task => task.due_date && task.assignee);

    let syncCount = 0;

    for (const task of tasksWithDeadline) {
      try {
        // 担当者がカレンダー連携しているかチェック
        const isConnected = await googleCalendarOAuthService.isCalendarConnected(task.assignee);

        if (!isConnected) {
          logger.debug('担当者がカレンダー連携していません', {
            taskId: task.task_id,
            assignee: task.assignee
          });
          continue;
        }

        const existingEvent = await findEventByTaskId(task.task_id, task.assignee);

        if (existingEvent) {
          await updateCalendarEvent(task);
        } else {
          await createCalendarEvent(task);
        }

        syncCount++;
      } catch (error) {
        logger.failure('タスク同期失敗', {
          taskId: task.task_id,
          error: error.message
        });
      }
    }

    logger.success('Google Calendar同期完了', { syncCount });

    return syncCount;
  } catch (error) {
    logger.failure('Google Calendar同期エラー', {
      error: error.message
    });
    return 0;
  }
}

module.exports = {
  isCalendarEnabled,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  markEventAsCompleted,
  syncAllTasksToCalendar,
  findEventByTaskId
};
