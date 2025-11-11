const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { supabase } = require('../db/connection');
const logger = require('../utils/logger');

const SALT_ROUNDS = 10;
const SESSION_EXPIRY_DAYS = 7;

/**
 * 新規ユーザーを登録する
 * @param {Object} userData - ユーザー登録データ
 * @param {string} userData.slackUserId - SlackユーザーID
 * @param {string} userData.email - メールアドレス
 * @param {string} userData.name - 名前
 * @param {string} userData.password - パスワード
 * @param {string} [userData.department] - 所属部署（オプション）
 * @returns {Promise<Object>} 登録されたユーザー情報
 */
async function registerUser({ slackUserId, email, name, password, department }) {
  try {
    // メールアドレスの重複チェック
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw new Error('このメールアドレスは既に登録されています');
    }

    // SlackユーザーIDの重複チェック
    const { data: existingSlackUser } = await supabase
      .from('users')
      .select('id')
      .eq('slack_user_id', slackUserId)
      .single();

    if (existingSlackUser) {
      throw new Error('このSlackユーザーIDは既に登録されています');
    }

    // パスワードをハッシュ化
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // ユーザーを作成
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([
        {
          slack_user_id: slackUserId,
          email: email.toLowerCase(),
          name,
          password_hash: passwordHash,
          department: department || null,
        },
      ])
      .select('id, slack_user_id, email, name, department, created_at')
      .single();

    if (error) {
      throw error;
    }

    logger.success('新規ユーザーを登録しました', { userId: newUser.id, email });
    return newUser;
  } catch (error) {
    logger.failure('ユーザー登録エラー', { error: error.message });
    throw error;
  }
}

/**
 * ログイン処理
 * @param {string} email - メールアドレス
 * @param {string} password - パスワード
 * @returns {Promise<Object>} ユーザー情報とセッショントークン
 */
async function login(email, password) {
  try {
    // ユーザーを検索
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      throw new Error('メールアドレスまたはパスワードが正しくありません');
    }

    // パスワードを検証
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new Error('メールアドレスまたはパスワードが正しくありません');
    }

    // セッショントークンを生成
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

    // セッションを保存
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert([
        {
          user_id: user.id,
          token: sessionToken,
          expires_at: expiresAt.toISOString(),
        },
      ]);

    if (sessionError) {
      throw sessionError;
    }

    logger.success('ユーザーがログインしました', { userId: user.id, email });

    // パスワードハッシュを除外して返す
    const { password_hash, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token: sessionToken,
      expiresAt,
    };
  } catch (error) {
    logger.failure('ログインエラー', { error: error.message });
    throw error;
  }
}

/**
 * セッショントークンを検証
 * @param {string} token - セッショントークン
 * @returns {Promise<Object>} ユーザー情報
 */
async function validateSession(token) {
  try {
    if (!token) {
      throw new Error('セッショントークンが提供されていません');
    }

    // セッションを検索
    const { data: session, error } = await supabase
      .from('sessions')
      .select('*, users(*)')
      .eq('token', token)
      .single();

    if (error || !session) {
      throw new Error('無効なセッショントークンです');
    }

    // セッションの有効期限をチェック
    const now = new Date();
    const expiresAt = new Date(session.expires_at);

    if (now > expiresAt) {
      // 期限切れのセッションを削除
      await supabase.from('sessions').delete().eq('id', session.id);
      throw new Error('セッションの有効期限が切れています');
    }

    // パスワードハッシュを除外
    const { password_hash, ...userWithoutPassword } = session.users;

    return userWithoutPassword;
  } catch (error) {
    logger.failure('セッション検証エラー', { error: error.message });
    throw error;
  }
}

/**
 * ログアウト処理
 * @param {string} token - セッショントークン
 * @returns {Promise<void>}
 */
async function logout(token) {
  try {
    if (!token) {
      throw new Error('セッショントークンが提供されていません');
    }

    // セッションを削除
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('token', token);

    if (error) {
      throw error;
    }

    logger.success('ユーザーがログアウトしました');
  } catch (error) {
    logger.failure('ログアウトエラー', { error: error.message });
    throw error;
  }
}

/**
 * 期限切れのセッションをクリーンアップ
 * @returns {Promise<void>}
 */
async function cleanupExpiredSessions() {
  try {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('sessions')
      .delete()
      .lt('expires_at', now);

    if (error) {
      throw error;
    }

    logger.info('期限切れセッションをクリーンアップしました');
  } catch (error) {
    logger.failure('セッションクリーンアップエラー', { error: error.message });
  }
}

module.exports = {
  registerUser,
  login,
  validateSession,
  logout,
  cleanupExpiredSessions,
};
