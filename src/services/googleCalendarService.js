const { google } = require('googleapis');
const logger = require('../utils/logger');
// taskServiceは循環依存を避けるため、使用箇所で遅延読み込み
const { supabase } = require('../db/connection');

// Google Calendar API クライアントの初期化
let calendar = null;
let isEnabled = false;

/**
 * Slack User IDからカレンダーIDを取得
 * @param {string} slackUserId - Slack User ID
 * @returns {Promise<string|null>} カレンダーIDまたはnull
 */
async function getCalendarIdBySlackUserId(slackUserId) {
  try {
    const { data, error } = await supabase
      .from('user_calendars')
      .select('calendar_id')
      .eq('slack_user_id', slackUserId)
      .single();

    if (error) {
      logger.warn('カレンダーID取得失敗', {
        slackUserId,
        error: error.message
      });
      return null;
    }

    return data?.calendar_id || null;
  } catch (error) {
    logger.failure('カレンダーID取得エラー', {
      slackUserId,
      error: error.message
    });
    return null;
  }
}

/**
 * Google Calendar APIを初期化
 */
function initializeCalendar() {
  try {
    // Service Account認証情報の確認
    if (!process.env.GOOGLE_CALENDAR_CREDENTIALS) {
      logger.info('Google Calendar連携は無効です（GOOGLE_CALENDAR_CREDENTIALSが設定されていません）');
      return false;
    }

    if (!process.env.GOOGLE_CALENDAR_ID) {
      logger.info('Google Calendar連携は無効です（GOOGLE_CALENDAR_IDが設定されていません）');
      return false;
    }

    // Service Accountの認証情報をパース
    const credentials = JSON.parse(process.env.GOOGLE_CALENDAR_CREDENTIALS);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });

    calendar = google.calendar({ version: 'v3', auth });
    isEnabled = true;

    logger.success('Google Calendar API初期化成功');
    return true;
  } catch (error) {
    logger.failure('Google Calendar API初期化エラー', {
      error: error.message
    });
    return false;
  }
}

/**
 * Google Calendar連携が有効かチェック
 */
function isCalendarEnabled() {
  return isEnabled;
}

/**
 * タスクをGoogle Calendarイベントとして作成
 * @param {Object} task - タスクオブジェクト
 * @returns {Promise<Object|null>} 作成されたイベント
 */
async function createCalendarEvent(task) {
  try {
    if (!isEnabled) {
      logger.warn('Google Calendar連携が無効です');
      return null;
    }

    if (!task.due_date) {
      logger.info('期限がないタスクはカレンダーに追加されません', {
        taskId: task.task_id
      });
      return null;
    }

    // 担当者のカレンダーIDを取得（見つからない場合は環境変数のカレンダーIDを使用）
    let calendarId = await getCalendarIdBySlackUserId(task.assignee);

    if (!calendarId) {
      logger.warn('担当者のカレンダーIDが見つかりません。デフォルトカレンダーを使用します', {
        assignee: task.assignee,
        taskId: task.task_id
      });
      calendarId = process.env.GOOGLE_CALENDAR_ID;
    } else {
      logger.info('担当者のカレンダーにイベントを作成します', {
        assignee: task.assignee,
        calendarId,
        taskId: task.task_id
      });
    }

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
          source: 'sapot-san'
        }
      }
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event
    });

    logger.success('Google Calendarイベント作成', {
      taskId: task.task_id,
      eventId: response.data.id
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
 * @returns {Promise<Object|null>} イベントまたはnull
 */
async function findEventByTaskId(taskId) {
  try {
    if (!isEnabled) return null;

    const calendarId = process.env.GOOGLE_CALENDAR_ID;

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
    if (!isEnabled) return null;

    if (!task.due_date) {
      // 期限がない場合は既存イベントを削除
      await deleteCalendarEvent(task.task_id);
      return null;
    }

    const existingEvent = await findEventByTaskId(task.task_id);

    if (!existingEvent) {
      // イベントが存在しない場合は新規作成
      return await createCalendarEvent(task);
    }

    // 担当者のカレンダーIDを取得
    let calendarId = await getCalendarIdBySlackUserId(task.assignee);

    if (!calendarId) {
      logger.warn('担当者のカレンダーIDが見つかりません。デフォルトカレンダーを使用します', {
        assignee: task.assignee,
        taskId: task.task_id
      });
      calendarId = process.env.GOOGLE_CALENDAR_ID;
    }

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
          source: 'sapot-san',
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
 * @returns {Promise<boolean>} 削除成功ならtrue
 */
async function deleteCalendarEvent(taskId) {
  try {
    if (!isEnabled) return false;

    const existingEvent = await findEventByTaskId(taskId);

    if (!existingEvent) {
      logger.info('削除するイベントが見つかりません', { taskId });
      return false;
    }

    const calendarId = process.env.GOOGLE_CALENDAR_ID;

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
    if (!isEnabled) return null;

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
    if (!isEnabled) {
      logger.warn('Google Calendar連携が無効です');
      return 0;
    }

    logger.info('全タスクをGoogle Calendarに同期開始');

    // 循環依存を避けるため、ここで遅延読み込み
    const taskService = require('./taskService');

    // 期限があるタスクのみ取得
    const allTasks = await taskService.getTasks({});
    const tasksWithDeadline = allTasks.filter(task => task.due_date);

    let syncCount = 0;

    for (const task of tasksWithDeadline) {
      try {
        const existingEvent = await findEventByTaskId(task.task_id);

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

// 初期化を実行
initializeCalendar();

module.exports = {
  isCalendarEnabled,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  markEventAsCompleted,
  syncAllTasksToCalendar,
  findEventByTaskId
};
