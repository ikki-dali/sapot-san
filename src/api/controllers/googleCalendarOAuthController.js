/**
 * Google Calendar OAuth認証コントローラー
 */
const googleCalendarOAuthService = require('../../services/googleCalendarOAuthService');
const logger = require('../../utils/logger');

/**
 * OAuth認証を開始（認証URLにリダイレクト）
 * GET /api/google-calendar/auth?slack_user_id=xxx
 */
async function startAuth(req, res) {
  try {
    const { slack_user_id } = req.query;

    if (!slack_user_id) {
      return res.status(400).json({
        success: false,
        error: 'slack_user_idが必要です'
      });
    }

    // 認証URLを生成
    const authUrl = googleCalendarOAuthService.getAuthorizationUrl(slack_user_id);

    logger.info('Google Calendar OAuth認証開始', { slack_user_id });

    // 認証URLにリダイレクト
    res.redirect(authUrl);

  } catch (error) {
    logger.failure('OAuth認証開始エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: '認証開始に失敗しました'
    });
  }
}

/**
 * OAuthコールバック（Googleから戻ってくる）
 * GET /api/google-calendar/callback?code=xxx&state=xxx
 */
async function handleCallback(req, res) {
  try {
    const { code, state: slackUserId, error } = req.query;

    // ユーザーが認証をキャンセルした場合
    if (error) {
      logger.warning('OAuth認証キャンセル', { slackUserId, error });
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>認証キャンセル</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px; }
            .message { max-width: 500px; margin: 0 auto; }
            .error { color: #d32f2f; }
          </style>
        </head>
        <body>
          <div class="message">
            <h1>❌ 認証がキャンセルされました</h1>
            <p class="error">Googleカレンダー連携は設定されませんでした。</p>
            <p>このウィンドウを閉じて、再度お試しください。</p>
          </div>
        </body>
        </html>
      `);
    }

    if (!code || !slackUserId) {
      logger.failure('OAuth認証パラメータ不足', { code: !!code, slackUserId });
      return res.status(400).send('認証に必要なパラメータが不足しています');
    }

    // 認証コードをトークンに交換して保存
    const success = await googleCalendarOAuthService.handleAuthCallback(code, slackUserId);

    if (success) {
      logger.success('OAuth認証完了', { slackUserId });
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>認証完了</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px; }
            .message { max-width: 500px; margin: 0 auto; }
            .success { color: #388e3c; }
          </style>
        </head>
        <body>
          <div class="message">
            <h1>✅ 認証完了！</h1>
            <p class="success">Googleカレンダーとの連携が完了しました。</p>
            <p>タスクが自動的にGoogleカレンダーに同期されます。</p>
            <p>このウィンドウを閉じて、ダッシュボードに戻ってください。</p>
          </div>
          <script>
            // 5秒後に自動でウィンドウを閉じる
            setTimeout(() => {
              window.close();
            }, 5000);
          </script>
        </body>
        </html>
      `);
    } else {
      logger.failure('OAuth認証失敗', { slackUserId });
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>認証エラー</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px; }
            .message { max-width: 500px; margin: 0 auto; }
            .error { color: #d32f2f; }
          </style>
        </head>
        <body>
          <div class="message">
            <h1>❌ 認証エラー</h1>
            <p class="error">認証処理中にエラーが発生しました。</p>
            <p>しばらく待ってから、もう一度お試しください。</p>
          </div>
        </body>
        </html>
      `);
    }

  } catch (error) {
    logger.failure('OAuthコールバックエラー', { error: error.message });
    res.status(500).send('認証処理中にエラーが発生しました');
  }
}

/**
 * 連携状態を確認
 * GET /api/google-calendar/status?slack_user_id=xxx
 */
async function getConnectionStatus(req, res) {
  try {
    const { slack_user_id } = req.query;

    if (!slack_user_id) {
      return res.status(400).json({
        success: false,
        error: 'slack_user_idが必要です'
      });
    }

    const isConnected = await googleCalendarOAuthService.isCalendarConnected(slack_user_id);

    res.json({
      success: true,
      connected: isConnected
    });

  } catch (error) {
    logger.failure('連携状態確認エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: '連携状態の確認に失敗しました'
    });
  }
}

/**
 * 連携を解除
 * POST /api/google-calendar/disconnect
 */
async function disconnectCalendar(req, res) {
  try {
    const { slack_user_id } = req.body;

    if (!slack_user_id) {
      return res.status(400).json({
        success: false,
        error: 'slack_user_idが必要です'
      });
    }

    const success = await googleCalendarOAuthService.disconnectCalendar(slack_user_id);

    if (success) {
      res.json({
        success: true,
        message: 'Googleカレンダー連携を解除しました'
      });
    } else {
      res.status(500).json({
        success: false,
        error: '連携解除に失敗しました'
      });
    }

  } catch (error) {
    logger.failure('連携解除エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: '連携解除に失敗しました'
    });
  }
}

module.exports = {
  startAuth,
  handleCallback,
  getConnectionStatus,
  disconnectCalendar
};
