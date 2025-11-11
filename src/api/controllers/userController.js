const { supabase } = require('../../db/connection');
const logger = require('../../utils/logger');

/**
 * 全ユーザー一覧を取得
 */
async function getAllUsers(req, res) {
  try {
    // カレンダー情報を含めるかどうか（デフォルト: false）
    const includeCalendar = req.query.includeCalendar === 'true';

    // ユーザー一覧を取得
    const { data: users, error } = await supabase
      .from('users')
      .select('id, slack_user_id, name, email, department, google_profile_picture, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // カレンダー情報が不要な場合はそのまま返す
    if (!includeCalendar) {
      res.json({
        success: true,
        data: users.map(user => ({
          ...user,
          hasCalendar: false,
          activeCalendars: 0,
          totalCalendars: 0,
        })),
      });
      return;
    }

    // カレンダー情報を取得（Google Calendar連携状態）
    const { data: googleTokens, error: tokenError } = await supabase
      .from('google_calendar_tokens')
      .select('slack_user_id')
      .in('slack_user_id', users.map(u => u.slack_user_id));

// Slack User IDのセットを作成
    const connectedSlackUserIds = new Set(googleTokens?.map(t => t.slack_user_id) || []);

// ユーザーごとにカレンダー設定状況を追加
    const usersWithCalendarStatus = users.map(user => {
      const hasCalendar = connectedSlackUserIds.has(user.slack_user_id);
return {
        ...user,
        hasCalendar,
        activeCalendars: hasCalendar ? 1 : 0,
        totalCalendars: hasCalendar ? 1 : 0,
      };
    });

    res.json({
      success: true,
      data: usersWithCalendarStatus,
    });
  } catch (error) {
    logger.failure('ユーザー一覧取得エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 部署一覧を取得（重複なし）
 */
async function getDepartments(req, res) {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('department')
      .not('department', 'is', null);

    if (error) {
      throw error;
    }

    // 重複を除去して部署一覧を作成
    const departments = [...new Set(users.map(u => u.department).filter(d => d))];

    res.json({
      success: true,
      data: departments.sort(),
    });
  } catch (error) {
    logger.failure('部署一覧取得エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * ユーザー情報を更新
 */
async function updateUser(req, res) {
  try {
    const { userId } = req.params;
    const { name, department } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (department !== undefined) updateData.department = department;

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, slack_user_id, name, email, department, google_profile_picture, created_at')
      .single();

    if (error) {
      throw error;
    }

    logger.success('ユーザー情報を更新しました', { userId, updateData });

    res.json({
      success: true,
      message: 'ユーザー情報を更新しました',
      data: user,
    });
  } catch (error) {
    logger.failure('ユーザー情報更新エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

module.exports = {
  getAllUsers,
  getDepartments,
  updateUser,
};
