const { supabase } = require('../db/connection');
const googleCalendarService = require('./googleCalendarService');

/**
 * 新しいタスクを作成
 * @param {Object} taskData - タスクデータ
 * @param {string} taskData.text - タスク内容
 * @param {string} taskData.channel - SlackチャンネルID
 * @param {string} taskData.messageTs - Slackメッセージタイムスタンプ
 * @param {string} taskData.createdBy - 作成者のSlackユーザーID
 * @param {string} taskData.assignee - 担当者のSlackユーザーID
 * @param {Date} [taskData.dueDate] - 期限（オプション）
 * @param {number} [taskData.priority] - 優先度（オプション、1-3）
 * @param {string} [taskData.summary] - AI要約（オプション）
 * @returns {Promise<Object>} 作成されたタスク
 */
async function createTask(taskData) {
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

    if (error) throw error;

    console.log(`✅ タスク作成: ${taskId}`);

    // Google Calendarに即座にイベントを作成
    if (googleCalendarService.isCalendarEnabled() && data.due_date) {
      try {
        await googleCalendarService.createCalendarEvent(data);
        console.log(`📅 Google Calendarイベント作成: ${taskId}`);
      } catch (calError) {
        console.error(`⚠️ カレンダーイベント作成エラー (${taskId}):`, calError.message);
        // カレンダー作成エラーはタスク作成を失敗させない
      }
    }

    return data;
  } catch (error) {
    console.error('❌ タスク作成エラー:', error.message);
    throw error;
  }
}

/**
 * タスクIDでタスクを取得
 * @param {string} taskId - タスクID
 * @returns {Promise<Object|null>} タスクオブジェクト
 */
async function getTaskById(taskId) {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('task_id', taskId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`❌ タスク取得エラー (${taskId}):`, error.message);
    throw error;
  }
}

/**
 * タスク一覧を取得
 * @param {Object} [filters] - フィルター条件
 * @param {string} [filters.assignee] - 担当者で絞り込み
 * @param {string} [filters.createdBy] - 作成者で絞り込み
 * @param {string} [filters.channel] - チャンネルで絞り込み
 * @param {string} [filters.status='open'] - ステータスで絞り込み
 * @returns {Promise<Array>} タスク配列
 */
async function getTasks(filters = {}) {
  try {
    let query = supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    // フィルター適用
    if (filters.status) {
      query = query.eq('status', filters.status);
    } else {
      query = query.eq('status', 'open'); // デフォルトは未完了のみ
    }

    if (filters.assignee) {
      query = query.eq('assignee', filters.assignee);
    }

    if (filters.createdBy) {
      query = query.eq('created_by', filters.createdBy);
    }

    if (filters.channel) {
      query = query.eq('channel', filters.channel);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('❌ タスク一覧取得エラー:', error.message);
    throw error;
  }
}

/**
 * タスクを完了状態にする
 * @param {string} taskId - タスクID
 * @param {string} completedBy - 完了者のSlackユーザーID
 * @returns {Promise<Object>} 更新されたタスク
 */
async function completeTask(taskId, completedBy) {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: completedBy
      })
      .eq('task_id', taskId)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ タスク完了: ${taskId}`);

    // Google Calendarイベントを更新（完了マーク）
    if (googleCalendarService.isCalendarEnabled()) {
      try {
        await googleCalendarService.markEventAsCompleted(taskId);
        console.log(`📅 Google Calendarイベント更新（完了）: ${taskId}`);
      } catch (calError) {
        console.error(`⚠️ カレンダーイベント更新エラー (${taskId}):`, calError.message);
      }
    }

    return data;
  } catch (error) {
    console.error(`❌ タスク完了エラー (${taskId}):`, error.message);
    throw error;
  }
}

/**
 * タスクを更新（汎用）
 * @param {string} taskId - タスクID
 * @param {Object} updates - 更新するフィールド
 * @returns {Promise<Object>} 更新されたタスク
 */
async function updateTask(taskId, updates) {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('task_id', taskId)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ タスク更新: ${taskId}`);

    // Google Calendarイベントを更新
    if (googleCalendarService.isCalendarEnabled()) {
      try {
        await googleCalendarService.updateCalendarEvent(data);
        console.log(`📅 Google Calendarイベント更新: ${taskId}`);
      } catch (calError) {
        console.error(`⚠️ カレンダーイベント更新エラー (${taskId}):`, calError.message);
      }
    }

    return data;
  } catch (error) {
    console.error(`❌ タスク更新エラー (${taskId}):`, error.message);
    throw error;
  }
}

/**
 * タスクを削除
 * @param {string} taskId - タスクID
 * @returns {Promise<boolean>} 削除成功ならtrue
 */
async function deleteTask(taskId) {
  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('task_id', taskId);

    if (error) throw error;

    console.log(`✅ タスク削除: ${taskId}`);
    return true;
  } catch (error) {
    console.error(`❌ タスク削除エラー (${taskId}):`, error.message);
    throw error;
  }
}

/**
 * 期限が近いタスクを取得（リマインダー用）
 * @param {number} hoursAhead - 何時間後までのタスクを取得するか
 * @returns {Promise<Array>} タスク配列
 */
async function getUpcomingTasks(hoursAhead = 24) {
  try {
    const now = new Date();
    const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'open')
      .gte('due_date', now.toISOString())
      .lte('due_date', future.toISOString())
      .order('due_date', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('❌ 期限近タスク取得エラー:', error.message);
    throw error;
  }
}

module.exports = {
  createTask,
  getTaskById,
  getTasks,
  completeTask,
  updateTask,
  deleteTask,
  getUpcomingTasks
};
