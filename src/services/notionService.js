const { Client } = require('@notionhq/client');
// taskServiceは循環依存を避けるため、使用箇所で遅延読み込み
const logger = require('../utils/logger');

// Notionクライアントの初期化
const notion = new Client({
  auth: process.env.NOTION_API_KEY
});

const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

/**
 * サポ田さんのタスクをNotionに同期
 * @param {Object} task - タスクオブジェクト
 * @returns {Promise<Object>} Notionページ
 */
async function syncTaskToNotion(task) {
  try {
    if (!NOTION_DATABASE_ID) {
      logger.warn('Notion Database IDが設定されていません');
      return null;
    }

    // 優先度をNotionのセレクトに変換
    const priorityMap = {
      1: '高',
      2: '中',
      3: '低'
    };

    // ステータスをNotionのセレクトに変換
    const statusMap = {
      'open': '未着手',
      'in_progress': '進行中',
      'completed': '完了'
    };

    const properties = {
      'タスク名': {
        title: [
          {
            text: {
              content: task.text
            }
          }
        ]
      },
      'ステータス': {
        select: {
          name: statusMap[task.status] || '未着手'
        }
      },
      '優先度': {
        select: {
          name: priorityMap[task.priority] || '中'
        }
      },
      'タスクID': {
        rich_text: [
          {
            text: {
              content: task.task_id
            }
          }
        ]
      },
      '担当者': {
        rich_text: [
          {
            text: {
              content: task.assignee || ''
            }
          }
        ]
      }
    };

    // 期限がある場合は追加
    if (task.due_date) {
      properties['期限'] = {
        date: {
          start: new Date(task.due_date).toISOString().split('T')[0]
        }
      };
    }

    // 完了日がある場合は追加
    if (task.completed_at) {
      properties['完了日'] = {
        date: {
          start: new Date(task.completed_at).toISOString().split('T')[0]
        }
      };
    }

    // Notionに既に存在するか確認
    const existingPage = await findNotionPageByTaskId(task.task_id);

    if (existingPage) {
      // 既存ページを更新
      const response = await notion.pages.update({
        page_id: existingPage.id,
        properties
      });

      logger.success('Notionタスク更新', {
        taskId: task.task_id,
        notionPageId: response.id
      });

      return response;
    } else {
      // 新規ページを作成
      const response = await notion.pages.create({
        parent: {
          database_id: NOTION_DATABASE_ID
        },
        properties
      });

      logger.success('Notionタスク作成', {
        taskId: task.task_id,
        notionPageId: response.id
      });

      return response;
    }
  } catch (error) {
    logger.failure('Notion同期エラー', {
      taskId: task.task_id,
      error: error.message
    });
    throw error;
  }
}

/**
 * タスクIDでNotionページを検索
 * @param {string} taskId - タスクID
 * @returns {Promise<Object|null>} Notionページまたはnull
 */
async function findNotionPageByTaskId(taskId) {
  try {
    if (!NOTION_DATABASE_ID) return null;

    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        property: 'タスクID',
        rich_text: {
          equals: taskId
        }
      }
    });

    if (response.results.length > 0) {
      return response.results[0];
    }

    return null;
  } catch (error) {
    logger.failure('Notionページ検索エラー', {
      taskId,
      error: error.message
    });
    return null;
  }
}

/**
 * Notionからサポ田さんDBにタスクを同期
 * @returns {Promise<number>} 同期したタスク数
 */
async function syncNotionToTasks() {
  try {
    if (!NOTION_DATABASE_ID) {
      logger.warn('Notion Database IDが設定されていません');
      return 0;
    }

    logger.info('Notionからタスク同期を開始');

    // 循環依存を避けるため、ここで遅延読み込み
    const taskService = require('./taskService');

    // Notionデータベースから全タスクを取得
    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID
    });

    let syncCount = 0;

    for (const page of response.results) {
      try {
        // Notionページからプロパティを抽出
        const props = page.properties;

        // タスクIDがない場合はスキップ
        const taskIdProp = props['タスクID']?.rich_text?.[0]?.text?.content;
        if (!taskIdProp) {
          logger.warn('タスクIDがないNotionページをスキップ', {
            pageId: page.id
          });
          continue;
        }

        // タスク名
        const taskName = props['タスク名']?.title?.[0]?.text?.content || '（タスク名なし）';

        // ステータス
        const statusMap = {
          '未着手': 'open',
          '進行中': 'in_progress',
          '完了': 'completed'
        };
        const notionStatus = props['ステータス']?.select?.name || '未着手';
        const status = statusMap[notionStatus] || 'open';

        // 優先度
        const priorityMap = {
          '高': 1,
          '中': 2,
          '低': 3
        };
        const notionPriority = props['優先度']?.select?.name || '中';
        const priority = priorityMap[notionPriority] || 2;

        // 担当者
        const assignee = props['担当者']?.rich_text?.[0]?.text?.content || 'notion_user';

        // 期限
        const dueDate = props['期限']?.date?.start || null;

        // 既存タスクを検索
        const existingTask = await taskService.getTaskById(taskIdProp);

        if (existingTask) {
          // 既存タスクを更新
          await taskService.updateTask(taskIdProp, {
            text: taskName,
            status,
            priority,
            assignee,
            due_date: dueDate
          });

          // 完了ステータスの場合は完了処理
          if (status === 'completed' && existingTask.status !== 'completed') {
            await taskService.completeTask(taskIdProp, 'notion_sync');
          }

          logger.info('Notionからタスク更新', { taskId: taskIdProp });
        }
        // 新規タスクの作成はスキップ（Notionから直接作成は想定しない）

        syncCount++;
      } catch (pageError) {
        logger.failure('Notionページ同期エラー', {
          pageId: page.id,
          error: pageError.message
        });
      }
    }

    logger.success('Notion同期完了', { syncCount });

    return syncCount;
  } catch (error) {
    logger.failure('Notion同期エラー', { error: error.message });
    throw error;
  }
}

/**
 * 全タスクをNotionに同期
 * @returns {Promise<number>} 同期したタスク数
 */
async function syncAllTasksToNotion() {
  try {
    if (!NOTION_DATABASE_ID) {
      logger.warn('Notion Database IDが設定されていません');
      return 0;
    }

    logger.info('全タスクをNotionに同期開始');

    // 循環依存を避けるため、ここで遅延読み込み
    const taskService = require('./taskService');

    // 全タスクを取得（オープンと完了両方）
    const [openTasks, completedTasks] = await Promise.all([
      taskService.getTasks({ status: 'open' }),
      taskService.getTasks({ status: 'completed' })
    ]);

    const allTasks = [...openTasks, ...completedTasks];

    let syncCount = 0;

    for (const task of allTasks) {
      try {
        await syncTaskToNotion(task);
        syncCount++;
      } catch (error) {
        logger.failure('タスク同期失敗', {
          taskId: task.task_id,
          error: error.message
        });
      }
    }

    logger.success('全タスク同期完了', { syncCount });

    return syncCount;
  } catch (error) {
    logger.failure('全タスク同期エラー', { error: error.message });
    throw error;
  }
}

/**
 * Notion連携が有効かチェック
 * @returns {boolean} Notion連携が有効ならtrue
 */
function isNotionEnabled() {
  return !!(process.env.NOTION_API_KEY && process.env.NOTION_DATABASE_ID);
}

module.exports = {
  syncTaskToNotion,
  syncNotionToTasks,
  syncAllTasksToNotion,
  findNotionPageByTaskId,
  isNotionEnabled
};
