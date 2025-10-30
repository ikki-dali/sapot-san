const taskService = require('../../services/taskService');
const tagService = require('../../services/tagService');
const logger = require('../../utils/logger');
const { supabase } = require('../../db/connection');

/**
 * タスク一覧を取得
 */
async function getTasks(req, res) {
  try {
    const { status, assignee, channel } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (assignee) filters.assignee = assignee;
    if (channel) filters.channel = channel;

    const tasks = await taskService.getTasks(filters);

    // タスクIDの配列を取得
    const taskIds = tasks.map(task => task.task_id);

    // タグ情報を一括取得
    const taskTagsMap = await tagService.getMultipleTaskTags(taskIds);

    // ユーザーIDとチャンネルIDを抽出
    const userIds = [...new Set(tasks.map(task => task.assignee).filter(Boolean))];
    const channelIds = [...new Set(tasks.map(task => task.channel).filter(Boolean))];

    // Slack APIでユーザー情報とチャンネル情報を一括取得
    const slackService = require('../../services/slackService');
    const [usersInfo, channelsInfo] = await Promise.all([
      slackService.getUsersInfo(userIds),
      slackService.getChannelsInfo(channelIds)
    ]);

    // 各タスクに名前情報を追加
    const tasksWithNames = tasks.map(task => {
      return {
        ...task,
        assignee_name: usersInfo[task.assignee]?.name || task.assignee,
        channel_name: channelsInfo[task.channel]?.name || task.channel,
        tags: taskTagsMap[task.task_id] || []
      };
    });

    logger.success('タスク一覧取得成功', { count: tasksWithNames.length, filters });

    res.json({
      success: true,
      data: tasksWithNames,
      count: tasksWithNames.length
    });
  } catch (error) {
    logger.failure('タスク一覧取得エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'タスク一覧の取得に失敗しました'
    });
  }
}

/**
 * タスクIDで単一タスクを取得
 */
async function getTaskById(req, res) {
  try {
    const { taskId } = req.params;

    const task = await taskService.getTaskById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'タスクが見つかりません'
      });
    }

    // タグ情報を取得
    const tags = await tagService.getTaskTags(taskId);

    logger.success('タスク取得成功', { taskId });

    res.json({
      success: true,
      data: {
        ...task,
        tags
      }
    });
  } catch (error) {
    logger.failure('タスク取得エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'タスクの取得に失敗しました'
    });
  }
}

/**
 * 新しいタスクを作成
 */
async function createTask(req, res) {
  try {
    const { text, channel, assignee, dueDate, priority, tagIds } = req.body;

    // バリデーション
    if (!text || !channel || !assignee) {
      return res.status(400).json({
        success: false,
        error: 'text, channel, assignee は必須です'
      });
    }

    const taskData = {
      text,
      channel,
      messageTs: `manual_${Date.now()}`, // 手動作成の場合
      createdBy: 'web_portal',
      assignee,
      dueDate: dueDate || null,
      priority: priority || 2
    };

    const newTask = await taskService.createTask(taskData);

    // タグが指定されている場合、タグを追加
    if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
      await tagService.addTagsToTask(newTask.task_id, tagIds);
    }

    // タグ情報を含めて返す
    const tags = await tagService.getTaskTags(newTask.task_id);

    logger.success('タスク作成成功', { taskId: newTask.task_id, tagCount: tags.length });

    res.status(201).json({
      success: true,
      data: {
        ...newTask,
        tags
      }
    });
  } catch (error) {
    logger.failure('タスク作成エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'タスクの作成に失敗しました'
    });
  }
}

/**
 * タスクを更新
 */
async function updateTask(req, res) {
  try {
    const { taskId } = req.params;
    const updates = req.body;

    // 存在チェック
    const existingTask = await taskService.getTaskById(taskId);
    if (!existingTask) {
      return res.status(404).json({
        success: false,
        error: 'タスクが見つかりません'
      });
    }

    const updatedTask = await taskService.updateTask(taskId, updates);

    logger.success('タスク更新成功', { taskId });

    res.json({
      success: true,
      data: updatedTask
    });
  } catch (error) {
    logger.failure('タスク更新エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'タスクの更新に失敗しました'
    });
  }
}

/**
 * タスクを完了
 */
async function completeTask(req, res) {
  try {
    const { taskId } = req.params;

    // 存在チェック
    const existingTask = await taskService.getTaskById(taskId);
    if (!existingTask) {
      return res.status(404).json({
        success: false,
        error: 'タスクが見つかりません'
      });
    }

    const completedTask = await taskService.completeTask(taskId, 'web_portal');

    logger.success('タスク完了成功', { taskId });

    res.json({
      success: true,
      data: completedTask
    });
  } catch (error) {
    logger.failure('タスク完了エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'タスクの完了に失敗しました'
    });
  }
}

/**
 * タスクを削除
 */
async function deleteTask(req, res) {
  try {
    const { taskId } = req.params;

    // 存在チェック
    const existingTask = await taskService.getTaskById(taskId);
    if (!existingTask) {
      return res.status(404).json({
        success: false,
        error: 'タスクが見つかりません'
      });
    }

    await taskService.deleteTask(taskId);

    logger.success('タスク削除成功', { taskId });

    res.json({
      success: true,
      message: 'タスクが削除されました'
    });
  } catch (error) {
    logger.failure('タスク削除エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'タスクの削除に失敗しました'
    });
  }
}

/**
 * 期限が近いタスクを取得
 */
async function getUpcomingTasks(req, res) {
  try {
    const { hours = 24 } = req.query;

    const tasks = await taskService.getUpcomingTasks(parseInt(hours));

    logger.success('期限近タスク取得成功', { count: tasks.length });

    res.json({
      success: true,
      data: tasks,
      count: tasks.length
    });
  } catch (error) {
    logger.failure('期限近タスク取得エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: '期限が近いタスクの取得に失敗しました'
    });
  }
}

/**
 * タスクに紐づくチャンネル一覧を取得
 */
async function getChannels(req, res) {
  try {
    const slackService = require('../../services/slackService');

    // タスクテーブルから重複を除いたチャンネルIDを取得
    const { data: channels, error } = await supabase
      .from('tasks')
      .select('channel')
      .not('channel', 'is', null);

    if (error) {
      throw error;
    }

    // 重複を除去
    const uniqueChannelIds = [...new Set(channels.map(c => c.channel))];

    // チャンネル情報を取得（ID => 名前に変換）
    const channelInfoMap = await slackService.getChannelsInfo(uniqueChannelIds);

    // ID と名前を含むオブジェクトの配列を作成
    const channelList = uniqueChannelIds.map(id => ({
      id,
      name: channelInfoMap[id]?.name || id
    }));

    logger.success('チャンネル一覧取得成功', { count: channelList.length });

    res.json({
      success: true,
      data: channelList,
      count: channelList.length
    });
  } catch (error) {
    logger.failure('チャンネル一覧取得エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'チャンネル一覧の取得に失敗しました'
    });
  }
}

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  completeTask,
  deleteTask,
  getUpcomingTasks,
  getChannels
};
