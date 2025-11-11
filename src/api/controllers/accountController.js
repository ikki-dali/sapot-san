const bcrypt = require('bcrypt');
const { supabase } = require('../../db/connection');
const logger = require('../../utils/logger');

const SALT_ROUNDS = 10;

/**
 * プロフィール情報を更新
 */
async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { name, department } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: '名前は必須です'
      });
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        name: name.trim(),
        department: department?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, slack_user_id, email, name, department, google_profile_picture')
      .single();

    if (error) {
      logger.failure('プロフィール更新エラー', { userId, error: error.message });
      return res.status(500).json({
        success: false,
        error: 'プロフィールの更新に失敗しました'
      });
    }

    logger.success('プロフィールを更新しました', { userId, name, department });

    res.json({
      success: true,
      data
    });

  } catch (error) {
    logger.failure('プロフィール更新エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'サーバーエラー'
    });
  }
}

/**
 * パスワードを変更
 */
async function updatePassword(req, res) {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: '現在のパスワードと新しいパスワードは必須です'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: '新しいパスワードは8文字以上である必要があります'
      });
    }

    // 現在のユーザー情報を取得
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({
        success: false,
        error: 'ユーザーが見つかりません'
      });
    }

    // 現在のパスワードを検証
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: '現在のパスワードが正しくありません'
      });
    }

    // 新しいパスワードをハッシュ化
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // パスワードを更新
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      logger.failure('パスワード更新エラー', { userId, error: updateError.message });
      return res.status(500).json({
        success: false,
        error: 'パスワードの更新に失敗しました'
      });
    }

    logger.success('パスワードを変更しました', { userId });

    res.json({
      success: true,
      message: 'パスワードを変更しました'
    });

  } catch (error) {
    logger.failure('パスワード更新エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'サーバーエラー'
    });
  }
}

module.exports = {
  updateProfile,
  updatePassword
};
