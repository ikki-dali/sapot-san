/**
 * Google Calendar OAuth 2.0 認証サービス
 * ユーザーごとのGoogleカレンダー連携を管理
 */
const { google } = require('googleapis');
const { supabase } = require('../db/connection');
const logger = require('../utils/logger');

// OAuth 2.0 クライアントの設定
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google-calendar/callback'
  );
}

/**
 * OAuth認証URLを生成
 * @param {string} slackUserId - SlackユーザーID
 * @returns {string} 認証URL
 */
function getAuthorizationUrl(slackUserId) {
  const oauth2Client = getOAuth2Client();

  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // リフレッシュトークンを取得
    scope: scopes,
    state: slackUserId, // コールバックでユーザーを識別
    prompt: 'consent' // 常に同意画面を表示してリフレッシュトークンを取得
  });

  return url;
}

/**
 * 認証コードをトークンに交換して保存
 * @param {string} code - 認証コード
 * @param {string} slackUserId - SlackユーザーID
 * @returns {Promise<boolean>} 成功したらtrue
 */
async function handleAuthCallback(code, slackUserId) {
  try {
    const oauth2Client = getOAuth2Client();

    // 認証コードをトークンに交換
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      logger.warning('リフレッシュトークンが取得できませんでした', { slackUserId });
      // 初回でない場合、refresh_tokenが返されないことがある
      // その場合は既存のトークンを使用
    }

    // トークンの有効期限を計算
    const expiryDate = new Date(tokens.expiry_date || Date.now() + 3600 * 1000);

    // トークンをDBに保存（upsert）
    const { error } = await supabase
      .from('google_calendar_tokens')
      .upsert({
        slack_user_id: slackUserId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || '', // 空文字の場合は既存値を保持
        token_expiry: expiryDate.toISOString(),
        calendar_id: 'primary',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'slack_user_id',
        ignoreDuplicates: false
      });

    if (error) {
      logger.failure('トークン保存エラー', { slackUserId, error: error.message });
      return false;
    }

    logger.success('Googleカレンダー連携完了', { slackUserId });
    return true;

  } catch (error) {
    logger.failure('OAuth認証エラー', { slackUserId, error: error.message });
    return false;
  }
}

/**
 * ユーザーのトークンを取得
 * @param {string} slackUserId - SlackユーザーID
 * @returns {Promise<Object|null>} トークン情報
 */
async function getUserTokens(slackUserId) {
  try {
    const { data, error } = await supabase
      .from('google_calendar_tokens')
      .select('*')
      .eq('slack_user_id', slackUserId)
      .single();

    if (error || !data) {
      return null;
    }

    return data;

  } catch (error) {
    logger.failure('トークン取得エラー', { slackUserId, error: error.message });
    return null;
  }
}

/**
 * トークンをリフレッシュ
 * @param {string} slackUserId - SlackユーザーID
 * @returns {Promise<string|null>} 新しいアクセストークン
 */
async function refreshAccessToken(slackUserId) {
  try {
    const tokenData = await getUserTokens(slackUserId);

    if (!tokenData || !tokenData.refresh_token) {
      logger.warning('リフレッシュトークンがありません', { slackUserId });
      return null;
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: tokenData.refresh_token
    });

    // トークンをリフレッシュ
    const { credentials } = await oauth2Client.refreshAccessToken();

    // 新しいトークンを保存
    const expiryDate = new Date(credentials.expiry_date || Date.now() + 3600 * 1000);

    const { error } = await supabase
      .from('google_calendar_tokens')
      .update({
        access_token: credentials.access_token,
        token_expiry: expiryDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('slack_user_id', slackUserId);

    if (error) {
      logger.failure('トークン更新エラー', { slackUserId, error: error.message });
      return null;
    }

    logger.success('トークンリフレッシュ成功', { slackUserId });
    return credentials.access_token;

  } catch (error) {
    logger.failure('トークンリフレッシュエラー', { slackUserId, error: error.message });
    return null;
  }
}

/**
 * 有効なOAuth2クライアントを取得（自動リフレッシュ付き）
 * @param {string} slackUserId - SlackユーザーID
 * @returns {Promise<Object|null>} 認証済みOAuth2クライアント
 */
async function getAuthenticatedClient(slackUserId) {
  try {
    const tokenData = await getUserTokens(slackUserId);

    if (!tokenData) {
      return null;
    }

    const oauth2Client = getOAuth2Client();

    // トークンが期限切れかチェック
    const now = new Date();
    const expiry = new Date(tokenData.token_expiry);

    if (now >= expiry) {
      // トークンをリフレッシュ
      const newAccessToken = await refreshAccessToken(slackUserId);

      if (!newAccessToken) {
        return null;
      }

      oauth2Client.setCredentials({
        access_token: newAccessToken,
        refresh_token: tokenData.refresh_token
      });
    } else {
      oauth2Client.setCredentials({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token
      });
    }

    return oauth2Client;

  } catch (error) {
    logger.failure('認証クライアント取得エラー', { slackUserId, error: error.message });
    return null;
  }
}

/**
 * ユーザーの連携を解除
 * @param {string} slackUserId - SlackユーザーID
 * @returns {Promise<boolean>} 成功したらtrue
 */
async function disconnectCalendar(slackUserId) {
  try {
    const { error } = await supabase
      .from('google_calendar_tokens')
      .delete()
      .eq('slack_user_id', slackUserId);

    if (error) {
      logger.failure('連携解除エラー', { slackUserId, error: error.message });
      return false;
    }

    logger.success('Googleカレンダー連携解除', { slackUserId });
    return true;

  } catch (error) {
    logger.failure('連携解除エラー', { slackUserId, error: error.message });
    return false;
  }
}

/**
 * ユーザーが連携済みかチェック
 * @param {string} slackUserId - SlackユーザーID
 * @returns {Promise<boolean>} 連携済みならtrue
 */
async function isCalendarConnected(slackUserId) {
  const tokenData = await getUserTokens(slackUserId);
  return tokenData !== null;
}

module.exports = {
  getAuthorizationUrl,
  handleAuthCallback,
  getUserTokens,
  refreshAccessToken,
  getAuthenticatedClient,
  disconnectCalendar,
  isCalendarConnected
};
