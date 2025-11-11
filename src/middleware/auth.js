const authService = require('../services/authService');
const logger = require('../utils/logger');

/**
 * 認証ミドルウェア
 * リクエストヘッダーのトークンを検証し、ユーザー情報をreq.userに追加
 */
async function authenticateToken(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'トークンが提供されていません',
      });
    }

    // セッションを検証
    const user = await authService.validateSession(token);

    // ユーザー情報をリクエストに追加
    req.user = user;

    next();
  } catch (error) {
    logger.failure('認証ミドルウェアエラー', { error: error.message });
    res.status(401).json({
      success: false,
      error: '認証に失敗しました',
    });
  }
}

module.exports = {
  authenticateToken,
};
