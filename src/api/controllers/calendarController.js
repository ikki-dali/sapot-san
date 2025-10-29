const { supabase } = require('../../db/connection');
const logger = require('../../utils/logger');

/**
 * ユーザーのカレンダー設定を取得
 */
async function getCalendarSettings(req, res) {
  try {
    const { data, error } = await supabase
      .from('user_calendars')
      .select('*')
      .order('display_name', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    logger.failure('カレンダー設定取得エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * カレンダー設定を保存
 */
async function saveCalendarSettings(req, res) {
  try {
    const { slackUserId, calendarId, displayName } = req.body;

    if (!slackUserId || !calendarId) {
      return res.status(400).json({
        success: false,
        error: 'slackUserIdとcalendarIdは必須です'
      });
    }

    // upsert（存在すれば更新、なければ挿入）
    const { data, error } = await supabase
      .from('user_calendars')
      .upsert({
        slack_user_id: slackUserId,
        calendar_id: calendarId,
        display_name: displayName || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'slack_user_id'
      })
      .select()
      .single();

    if (error) throw error;

    logger.success('カレンダー設定保存成功', {
      slackUserId,
      calendarId
    });

    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.failure('カレンダー設定保存エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * カレンダー設定を削除
 */
async function deleteCalendarSettings(req, res) {
  try {
    const { slackUserId } = req.params;

    const { error } = await supabase
      .from('user_calendars')
      .delete()
      .eq('slack_user_id', slackUserId);

    if (error) throw error;

    logger.success('カレンダー設定削除成功', { slackUserId });

    res.json({
      success: true,
      message: 'カレンダー設定を削除しました'
    });
  } catch (error) {
    logger.failure('カレンダー設定削除エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  getCalendarSettings,
  saveCalendarSettings,
  deleteCalendarSettings
};
