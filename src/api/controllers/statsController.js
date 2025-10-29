const taskService = require('../../services/taskService');
const unrepliedService = require('../../services/unrepliedService');
const { supabase } = require('../../db/connection');
const logger = require('../../utils/logger');

/**
 * ダッシュボード統計を取得
 */
async function getDashboardStats(req, res) {
  try {
    // タスク統計
    const [openTasks, completedTasks, upcomingTasks] = await Promise.all([
      taskService.getTasks({ status: 'open' }),
      taskService.getTasks({ status: 'completed' }),
      taskService.getUpcomingTasks(24)
    ]);

    // 優先度別タスク数
    const priorityCounts = {
      high: 0,
      medium: 0,
      low: 0
    };

    openTasks.forEach(task => {
      if (task.priority === 1) priorityCounts.high++;
      else if (task.priority === 2) priorityCounts.medium++;
      else if (task.priority === 3) priorityCounts.low++;
    });

    // 未返信メッセージ統計
    const unrepliedStats = await unrepliedService.getUnrepliedStats();

    // チャンネル別タスク数
    const channelCounts = {};
    openTasks.forEach(task => {
      channelCounts[task.channel] = (channelCounts[task.channel] || 0) + 1;
    });

    const stats = {
      tasks: {
        open: openTasks.length,
        completed: completedTasks.length,
        upcoming: upcomingTasks.length,
        total: openTasks.length + completedTasks.length
      },
      priority: priorityCounts,
      unreplied: unrepliedStats,
      channels: channelCounts
    };

    logger.success('統計情報取得成功');

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.failure('統計情報取得エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: '統計情報の取得に失敗しました'
    });
  }
}

/**
 * タスク完了率の推移を取得（過去7日間）
 */
async function getTaskTrend(req, res) {
  try {
    const { days = 7 } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const { data, error } = await supabase
      .from('tasks')
      .select('completed_at, created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // 日付ごとにグループ化
    const trendData = [];
    for (let i = 0; i < parseInt(days); i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const created = data.filter(task =>
        task.created_at && task.created_at.startsWith(dateStr)
      ).length;

      const completed = data.filter(task =>
        task.completed_at && task.completed_at.startsWith(dateStr)
      ).length;

      trendData.push({
        date: dateStr,
        created,
        completed
      });
    }

    logger.success('タスク推移取得成功', { days });

    res.json({
      success: true,
      data: trendData
    });
  } catch (error) {
    logger.failure('タスク推移取得エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'タスク推移の取得に失敗しました'
    });
  }
}

module.exports = {
  getDashboardStats,
  getTaskTrend
};
