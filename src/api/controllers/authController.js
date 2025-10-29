const authService = require('../../services/authService');
const logger = require('../../utils/logger');

/**
 * 新規ユーザー登録
 */
async function register(req, res) {
  try {
    const { slackUserId, email, name, password } = req.body;

    // バリデーション
    if (!slackUserId || !email || !name || !password) {
      return res.status(400).json({
        success: false,
        error: 'すべてのフィールドを入力してください',
      });
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: '有効なメールアドレスを入力してください',
      });
    }

    // パスワードの長さチェック
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'パスワードは6文字以上である必要があります',
      });
    }

    // ユーザー登録
    const user = await authService.registerUser({
      slackUserId,
      email,
      name,
      password,
    });

    res.status(201).json({
      success: true,
      message: 'ユーザー登録が完了しました',
      data: user,
    });
  } catch (error) {
    logger.failure('ユーザー登録エラー', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * ログイン
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // バリデーション
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'メールアドレスとパスワードを入力してください',
      });
    }

    // ログイン処理
    const result = await authService.login(email, password);

    res.json({
      success: true,
      message: 'ログインしました',
      data: result,
    });
  } catch (error) {
    logger.failure('ログインエラー', { error: error.message });
    res.status(401).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * ログアウト
 */
async function logout(req, res) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'トークンが提供されていません',
      });
    }

    await authService.logout(token);

    res.json({
      success: true,
      message: 'ログアウトしました',
    });
  } catch (error) {
    logger.failure('ログアウトエラー', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * セッション検証（現在のユーザー情報取得）
 */
async function getCurrentUser(req, res) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'トークンが提供されていません',
      });
    }

    const user = await authService.validateSession(token);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.failure('セッション検証エラー', { error: error.message });
    res.status(401).json({
      success: false,
      error: error.message,
    });
  }
}

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
};
