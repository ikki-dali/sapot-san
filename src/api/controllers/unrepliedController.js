const unrepliedService = require('../../services/unrepliedService');
const logger = require('../../utils/logger');
const { supabase } = require('../../db/connection');

/**
 * 未返信メンション一覧を取得
 */
async function getUnrepliedMentions(req, res) {
  try {
    const { hours = 2 } = req.query;

    const mentions = await unrepliedService.getUnrepliedMentions(parseInt(hours));

    logger.success('未返信メンション取得成功', { count: mentions.length });

    res.json({
      success: true,
      data: mentions
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
 * メンションを既読にする
 */
async function markAsReplied(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('unreplied_mentions')
      .update({
        replied_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logger.success('メンション既読マーク成功', { id });

    res.json({
      success: true,
      data
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
