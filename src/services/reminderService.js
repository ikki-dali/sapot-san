const cron = require('node-cron');
const taskService = require('./taskService');
const { supabase } = require('../db/connection');
const unrepliedService = require('./unrepliedService');
const notionService = require('./notionService');
const googleCalendarService = require('./googleCalendarService');

// 通知履歴を管理するMap (task_id => 最後の通知時刻)
const reminderHistory = new Map();

// 通知間隔（ミリ秒）- デフォルト1時間
const REMINDER_INTERVAL = 60 * 60 * 1000;

/**
 * タスクが最近通知されたかチェック
 * @param {string} taskId - タスクID
 * @returns {boolean} 通知可能ならtrue
 */
function canSendReminder(taskId) {
  const lastRemindedAt = reminderHistory.get(taskId);
  if (!lastRemindedAt) {
    return true; // 初回通知
  }

  const now = Date.now();
  const timeSinceLastReminder = now - lastRemindedAt;

  return timeSinceLastReminder >= REMINDER_INTERVAL;
}

/**
 * 通知履歴を記録
 * @param {string} taskId - タスクID
 */
function recordReminder(taskId) {
  reminderHistory.set(taskId, Date.now());
}

/**
 * 期限が近いタスクをチェックして通知を送る
 * @param {Object} slackClient - Slack Boltのclientオブジェクト
 * @param {number} hoursAhead - 何時間後までのタスクを通知するか（デフォルト24時間）
 */
async function checkUpcomingDeadlines(slackClient, hoursAhead = 24) {
  try {
    console.log(`⏰ 期限チェック開始（${hoursAhead}時間以内）`);

    // 期限が近いタスクを取得
    const upcomingTasks = await taskService.getUpcomingTasks(hoursAhead);

    if (upcomingTasks.length === 0) {
      console.log('✅ 期限が近いタスクはありません');
      return;
    }

    console.log(`📋 ${upcomingTasks.length}件のタスクの期限が近づいています`);

    let sentCount = 0;
    let skippedCount = 0;

    // 各タスクについて通知を送る
    for (const task of upcomingTasks) {
      if (canSendReminder(task.task_id)) {
        await sendDeadlineReminder(slackClient, task);
        recordReminder(task.task_id);
        sentCount++;
      } else {
        console.log(`⏭️  スキップ: ${task.task_id} (最近通知済み)`);
        skippedCount++;
      }
    }

    console.log(`✅ 期限通知完了 (送信: ${sentCount}件, スキップ: ${skippedCount}件)`);
  } catch (error) {
    console.error('❌ 期限チェックエラー:', error);
  }
}

/**
 * 期限切れタスクをチェックして通知を送る
 * @param {Object} slackClient - Slack Boltのclientオブジェクト
 */
async function checkOverdueTasks(slackClient) {
  try {
    console.log('🚨 期限切れタスクチェック開始');

    const now = new Date();

    // 期限切れの未完了タスクを取得
    const { data: overdueTasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'open')
      .lt('due_date', now.toISOString())
      .order('due_date', { ascending: true });

    if (error) throw error;

    if (!overdueTasks || overdueTasks.length === 0) {
      console.log('✅ 期限切れタスクはありません');
      return;
    }

    console.log(`⚠️ ${overdueTasks.length}件の期限切れタスクがあります`);

    let sentCount = 0;
    let skippedCount = 0;

    // 各タスクについて通知を送る
    for (const task of overdueTasks) {
      if (canSendReminder(task.task_id)) {
        await sendOverdueReminder(slackClient, task);
        recordReminder(task.task_id);
        sentCount++;
      } else {
        console.log(`⏭️  スキップ: ${task.task_id} (最近通知済み)`);
        skippedCount++;
      }
    }

    console.log(`✅ 期限切れ通知完了 (送信: ${sentCount}件, スキップ: ${skippedCount}件)`);
  } catch (error) {
    console.error('❌ 期限切れチェックエラー:', error);
  }
}

/**
 * 期限が近いタスクの通知を送信
 * @param {Object} slackClient - Slack Boltのclientオブジェクト
 * @param {Object} task - タスクオブジェクト
 */
async function sendDeadlineReminder(slackClient, task) {
  try {
    const dueDate = new Date(task.due_date);
    const now = new Date();
    const hoursUntilDue = Math.round((dueDate - now) / (1000 * 60 * 60));

    const dueDateStr = dueDate.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    });

    const message = {
      channel: task.channel,
      text: `⏰ *タスクの期限が近づいています*`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⏰ *タスクの期限が近づいています*\n\n*タスクID:* ${task.task_id}\n*内容:* ${task.text}\n*担当:* <@${task.assignee}>\n*期限:* ${dueDateStr}\n*残り時間:* 約${hoursUntilDue}時間`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `完了したら \`/task-done ${task.task_id}\` を実行してください`
            }
          ]
        }
      ]
    };

    // 元のスレッドがあれば返信
    if (task.message_ts && !task.message_ts.startsWith('manual_')) {
      message.thread_ts = task.message_ts;
    }

    await slackClient.chat.postMessage(message);

    console.log(`📨 通知送信: ${task.task_id} (期限まで${hoursUntilDue}時間)`);
  } catch (error) {
    console.error(`❌ 通知送信エラー (${task.task_id}):`, error);
  }
}

/**
 * 期限切れタスクの通知を送信
 * @param {Object} slackClient - Slack Boltのclientオブジェクト
 * @param {Object} task - タスクオブジェクト
 */
async function sendOverdueReminder(slackClient, task) {
  try {
    const dueDate = new Date(task.due_date);
    const now = new Date();
    const daysPastDue = Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24));

    const dueDateStr = dueDate.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    });

    const message = {
      channel: task.channel,
      text: `🚨 *タスクの期限が過ぎています*`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🚨 *タスクの期限が過ぎています*\n\n*タスクID:* ${task.task_id}\n*内容:* ${task.text}\n*担当:* <@${task.assignee}>\n*期限:* ${dueDateStr}\n*経過日数:* ${daysPastDue}日`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `完了したら \`/task-done ${task.task_id}\` を実行してください`
            }
          ]
        }
      ]
    };

    // 元のスレッドがあれば返信
    if (task.message_ts && !task.message_ts.startsWith('manual_')) {
      message.thread_ts = task.message_ts;
    }

    await slackClient.chat.postMessage(message);

    console.log(`📨 期限切れ通知送信: ${task.task_id} (${daysPastDue}日経過)`);
  } catch (error) {
    console.error(`❌ 期限切れ通知送信エラー (${task.task_id}):`, error);
  }
}

/**
 * リマインダーcronジョブを開始
 * @param {Object} slackClient - Slack Boltのclientオブジェクト
 */
function startReminderJobs(slackClient) {
  // 毎日朝9時に期限チェック（24時間以内）
  cron.schedule('0 9 * * *', () => {
    console.log('🔔 [定期実行] 朝のリマインダーチェック');
    checkUpcomingDeadlines(slackClient, 24);
  }, {
    timezone: 'Asia/Tokyo'
  });

  // 毎日夕方18時に期限切れチェック
  cron.schedule('0 18 * * *', () => {
    console.log('🔔 [定期実行] 期限切れタスクチェック');
    checkOverdueTasks(slackClient);
  }, {
    timezone: 'Asia/Tokyo'
  });

  // 1時間ごとに実行: 2-3時間以内に期限が来るタスクを通知
  cron.schedule('0 * * * *', () => {
    console.log('🔔 [定期実行] 1時間ごとのチェック（2-3時間前通知）');
    checkUpcomingDeadlines(slackClient, 3);
  }, {
    timezone: 'Asia/Tokyo'
  });

  // 毎日午前10時に未返信メッセージチェック（24時間以上）
  cron.schedule('0 10 * * *', () => {
    console.log('🔔 [定期実行] 未返信メッセージ自動タスク化チェック');
    unrepliedService.checkAndAutoTaskUnreplied(slackClient, 24);
  }, {
    timezone: 'Asia/Tokyo'
  });

  // Notion連携が有効な場合のみ、定期同期ジョブを起動
  if (notionService.isNotionEnabled()) {
    // 15分ごとにNotionと双方向同期
    cron.schedule('*/15 * * * *', async () => {
      console.log('🔔 [定期実行] Notion双方向同期');
      try {
        // Notionからサポ田さんへ
        const fromNotion = await notionService.syncNotionToTasks();
        console.log(`  ↓ Notion → サポ田さん: ${fromNotion}件`);

        // サポ田さんからNotionへ
        const toNotion = await notionService.syncAllTasksToNotion();
        console.log(`  ↑ サポ田さん → Notion: ${toNotion}件`);
      } catch (error) {
        console.error('❌ Notion同期エラー:', error.message);
      }
    }, {
      timezone: 'Asia/Tokyo'
    });

    console.log('✅ リマインダーcronジョブを開始しました（Notion連携有効）');
    console.log('  - 毎時 0分: 2-3時間以内の期限タスク通知');
    console.log('  - 毎日 9:00: 24時間以内の期限タスク通知');
    console.log('  - 毎日 10:00: 未返信メッセージ自動タスク化');
    console.log('  - 毎日 18:00: 期限切れタスク通知');
    console.log('  - 15分ごと: Notion双方向同期');
  } else {
    console.log('✅ リマインダーcronジョブを開始しました');
    console.log('  - 毎時 0分: 2-3時間以内の期限タスク通知');
    console.log('  - 毎日 9:00: 24時間以内の期限タスク通知');
    console.log('  - 毎日 10:00: 未返信メッセージ自動タスク化');
    console.log('  - 毎日 18:00: 期限切れタスク通知');
    console.log('  ℹ️ Notion連携は無効です（.envでNOTION_API_KEYとNOTION_DATABASE_IDを設定してください）');
  }

  // Google Calendar連携が有効な場合のみ、定期同期ジョブを起動
  if (googleCalendarService.isCalendarEnabled()) {
    // 30分ごとにGoogle Calendarと同期
    cron.schedule('*/30 * * * *', async () => {
      console.log('🔔 [定期実行] Google Calendar同期');
      try {
        const syncCount = await googleCalendarService.syncAllTasksToCalendar();
        console.log(`  ↑ サポ田さん → Google Calendar: ${syncCount}件`);
      } catch (error) {
        console.error('❌ Google Calendar同期エラー:', error.message);
      }
    }, {
      timezone: 'Asia/Tokyo'
    });

    console.log('  - 30分ごと: Google Calendar同期');
  } else {
    console.log('  ℹ️ Google Calendar連携は無効です（.envでGOOGLE_CALENDAR_CREDENTIALSとGOOGLE_CALENDAR_IDを設定してください）');
  }
}

module.exports = {
  checkUpcomingDeadlines,
  checkOverdueTasks,
  sendDeadlineReminder,
  sendOverdueReminder,
  startReminderJobs
};
