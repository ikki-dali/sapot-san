const unrepliedService = require('../../services/unrepliedService');
const slackService = require('../../services/slackService');
const logger = require('../../utils/logger');
const { supabase } = require('../../db/connection');

/**
 * 未返信メンション一覧を取得
 */
async function getUnrepliedMentions(req, res) {
  try {
    const { hours = 2 } = req.query;

    const mentions = await unrepliedService.getUnrepliedMentions(parseInt(hours));

    // ユーザーIDとチャンネルIDを抽出
    const userIds = [];
    const channelIds = [];
    mentions.forEach(mention => {
      if (mention.mentioned_user) userIds.push(mention.mentioned_user);
      if (mention.mentioner_user) userIds.push(mention.mentioner_user);
      if (mention.channel) channelIds.push(mention.channel);
    });

    // ユーザー情報とチャンネル情報を一括取得
    const [usersInfo, channelsInfo] = await Promise.all([
      slackService.getUsersInfo(userIds),
      slackService.getChannelsInfo(channelIds)
    ]);

    // メンションにユーザー名とチャンネル名を追加
    const mentionsWithNames = mentions.map(mention => ({
      ...mention,
      mentioned_user_name: usersInfo[mention.mentioned_user]?.name || mention.mentioned_user,
      mentioner_user_name: usersInfo[mention.mentioner_user]?.name || mention.mentioner_user,
      channel_name: channelsInfo[mention.channel]?.name || mention.channel
    }));

    logger.success('未返信メンション取得成功', { count: mentions.length });

    res.json({
      success: true,
      data: mentionsWithNames
    });
  } catch (error) {
    logger.failure('未返信メンション取得エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: '未返信メンションの取得に失敗しました'
    });
  }
}

/**
 * 未返信統計を取得
 */
async function getUnrepliedStats(req, res) {
  try {
    const stats = await unrepliedService.getUnrepliedStats();

    logger.success('未返信統計取得成功');

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.failure('未返信統計取得エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: '未返信統計の取得に失敗しました'
    });
  }
}

/**
 * メンションを既読にする（タスク化）
 */
async function markAsReplied(req, res) {
  try {
    const { id } = req.params;
    const taskService = require('../../services/taskService');

    // 未返信メンションを取得
    const { data: mention, error: fetchError } = await supabase
      .from('unreplied_mentions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (!mention) {
      return res.status(404).json({
        success: false,
        error: 'メンションが見つかりません'
      });
    }

    // タスクを作成
    const newTask = await taskService.createTask({
      text: `【既読確認】${mention.message_text}`,
      channel: mention.channel,
      messageTs: mention.message_ts,
      createdBy: 'manual_mark_system',
      assignee: mention.mentioned_user,
      priority: 2
    });

    // 未返信メンションを既読に更新
    const { data, error } = await supabase
      .from('unreplied_mentions')
      .update({
        replied_at: new Date().toISOString(),
        auto_tasked: true,
        task_id: newTask.task_id
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logger.success('メンション既読マーク & タスク化成功', { id, task_id: newTask.task_id });

    res.json({
      success: true,
      data: {
        mention: data,
        task: newTask
      }
    });
  } catch (error) {
    logger.failure('メンション既読マークエラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'メンションの既読マークに失敗しました'
    });
  }
}

module.exports = {
  getUnrepliedMentions,
  getUnrepliedStats,
  markAsReplied
};
