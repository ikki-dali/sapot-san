/**
 * Googleカレンダー一覧取得コントローラー
 */
const googleCalendarOAuthService = require('../../services/googleCalendarOAuthService');
const { google } = require('googleapis');
const logger = require('../../utils/logger');

/**
 * ユーザーのカレンダー一覧を取得
 * GET /api/google-calendar/calendars?slack_user_id=xxx
 */
async function getCalendarList(req, res) {
  try {
    const { slack_user_id } = req.query;

    if (!slack_user_id) {
      return res.status(400).json({
        success: false,
        error: 'slack_user_idが必要です'
      });
    }

    // OAuth2クライアントを取得
    const oauth2Client = await googleCalendarOAuthService.getAuthenticatedClient(slack_user_id);

    if (!oauth2Client) {
      return res.status(401).json({
        success: false,
        error: 'Googleカレンダー連携が必要です',
        authUrl: `/api/google-calendar/auth?slack_user_id=${slack_user_id}`
      });
    }

    // カレンダー一覧を取得
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const response = await calendar.calendarList.list();

    const calendars = response.data.items.map(cal => ({
      id: cal.id,
      summary: cal.summary,
      description: cal.description,
      primary: cal.primary || false,
      accessRole: cal.accessRole,
      backgroundColor: cal.backgroundColor
    }));

    logger.success('カレンダー一覧取得成功', {
      slackUserId: slack_user_id,
      count: calendars.length
    });

    res.json({
      success: true,
      calendars
    });

  } catch (error) {
    logger.failure('カレンダー一覧取得エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'カレンダー一覧の取得に失敗しました'
    });
  }
}

/**
 * 使用するカレンダーを設定
 * POST /api/google-calendar/select-calendar
 * Body: { slack_user_id, calendar_id }
 */
async function selectCalendar(req, res) {
  try {
    const { slack_user_id, calendar_id } = req.body;

    if (!slack_user_id || !calendar_id) {
      return res.status(400).json({
        success: false,
        error: 'slack_user_idとcalendar_idが必要です'
      });
    }

    // カレンダーIDを更新
    const success = await googleCalendarOAuthService.updateCalendarId(slack_user_id, calendar_id);

    if (success) {
      logger.success('カレンダー選択完了', { slackUserId: slack_user_id, calendarId: calendar_id });
      res.json({
        success: true,
        message: 'カレンダーが設定されました',
        calendar_id
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'カレンダーの設定に失敗しました'
      });
    }

  } catch (error) {
    logger.failure('カレンダー選択エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'カレンダーの設定に失敗しました'
    });
  }
}

module.exports = {
  getCalendarList,
  selectCalendar
};
