const logger = require('./logger');
const { supabase } = require('../db/connection');

/**
 * データベースからユーザー名を取得
 * @param {string} userId - Slack User ID（例: "U09CAH6FZPW"）
 * @returns {Promise<string|null>} - 登録済みのユーザー名、または null
 */
async function getUserNameFromDatabase(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('name')
      .eq('slack_user_id', userId)
      .single();

    if (error) {
      logger.info(`🔍 DB検索: ユーザー ${userId} が見つかりません`);
      return null;
    }

    if (data && data.name) {
      logger.success(`✅ DB検索成功: ${userId} → ${data.name}`);
      return data.name;
    }

    return null;
  } catch (err) {
    logger.failure(`DB検索エラー (${userId})`, { error: err.message });
    return null;
  }
}

/**
 * メッセージ内のSlackメンションIDをユーザー名に置換
 * @param {string} text - 元のメッセージテキスト（例: "<@U09CAH6FZPW> サポ田さんの確認お願いします。"）
 * @param {Object} client - Slack Web API クライアント
 * @returns {Promise<string>} - 置換後のテキスト（例: "@山本 一気 サポ田さんの確認お願いします。"）
 */
async function replaceMentionsWithNames(text, client) {
  if (!text) return text;

  logger.info('🔄 メンション置換を開始', { originalText: text.substring(0, 100) });

  let replacedText = text;

  // 1. ユーザーメンション <@U12345> を処理
  const mentionRegex = /<@([A-Z0-9]+)>/g;
  const mentions = [...text.matchAll(mentionRegex)];

  if (mentions.length > 0) {
    logger.info(`👤 ${mentions.length}件のユーザーメンションを検出`);
  }

  for (const match of mentions) {
    const userId = match[1];
    const mentionTag = match[0]; // <@U12345>

    try {
      // まずデータベースから名前を取得
      let userName = await getUserNameFromDatabase(userId);

      // データベースに見つからない場合は Slack API から取得
      if (!userName) {
        logger.info(`🌐 Slack APIからユーザー情報を取得: ${userId}`);
        const userInfo = await client.users.info({ user: userId });

        if (userInfo.ok && userInfo.user) {
          // 実名（real_name）または表示名（display_name）を使用
          userName = userInfo.user.profile.real_name ||
                            userInfo.user.profile.display_name ||
                            userInfo.user.name;
        }
      }

      if (userName) {
        logger.success(`✅ メンション置換: ${mentionTag} → @${userName}`);

        // メンションを @ユーザー名 に置換
        replacedText = replacedText.replace(mentionTag, `@${userName}`);
      }
    } catch (error) {
      logger.failure(`ユーザー情報取得エラー (${userId})`, { error: error.message });
      // エラーの場合はIDのまま残す
    }
  }

  // 2. ユーザーグループメンション <!subteam^S12345> を処理
  const subteamRegex = /<!subteam\^([A-Z0-9]+)(\|[^>]+)?>/g;
  const subteamMentions = [...text.matchAll(subteamRegex)];

  if (subteamMentions.length > 0) {
    logger.info(`👥 ${subteamMentions.length}件のユーザーグループメンションを検出`);
  }

  for (const match of subteamMentions) {
    const subteamId = match[1];
    const subteamTag = match[0]; // <!subteam^S12345>

    try {
      // Slack APIでユーザーグループ情報を取得
      const subteamInfo = await client.usergroups.info({ usergroup: subteamId });

      if (subteamInfo.ok && subteamInfo.usergroup) {
        const groupName = subteamInfo.usergroup.handle || subteamInfo.usergroup.name;

        logger.success(`✅ グループメンション置換: ${subteamTag} → @${groupName}`);

        // メンションを @グループ名 に置換
        replacedText = replacedText.replace(subteamTag, `@${groupName}`);
      }
    } catch (error) {
      logger.failure(`ユーザーグループ情報取得エラー (${subteamId})`, { error: error.message });
      // エラーの場合はIDのまま残す
    }
  }

  if (replacedText !== text) {
    logger.success('🎉 メンション置換完了', {
      before: text.substring(0, 50),
      after: replacedText.substring(0, 50)
    });
  }

  return replacedText;
}

/**
 * チャンネルIDをチャンネル名に置換
 * @param {string} text - 元のメッセージテキスト
 * @param {Object} client - Slack Web API クライアント
 * @returns {Promise<string>} - 置換後のテキスト
 */
async function replaceChannelIdsWithNames(text, client) {
  if (!text) return text;

  // <#C12345|channel-name> のようなチャンネルメンションを抽出
  const channelRegex = /<#([A-Z0-9]+)(\|[^>]+)?>/g;
  const matches = [...text.matchAll(channelRegex)];

  if (matches.length === 0) {
    return text;
  }

  let replacedText = text;

  logger.info(`📺 ${matches.length}件のチャンネルメンションを検出`);

  for (const match of matches) {
    const channelId = match[1];
    const channelTag = match[0];

    try {
      const channelInfo = await client.conversations.info({ channel: channelId });

      if (channelInfo.ok && channelInfo.channel) {
        const channelName = channelInfo.channel.name;
        logger.success(`✅ チャンネルメンション置換: ${channelTag} → #${channelName}`);
        replacedText = replacedText.replace(channelTag, `#${channelName}`);
      }
    } catch (error) {
      logger.failure(`チャンネル情報取得エラー (${channelId})`, { error: error.message });
    }
  }

  return replacedText;
}

/**
 * メッセージテキストから日付を抽出して期限を設定
 * サポートする形式:
 * - "11/18" → 今年の11月18日
 * - "2024/11/18" → 2024年11月18日
 * - "11月18日" → 今年の11月18日
 * - "明日" → 翌日
 * - "来週" → 7日後
 * @param {string} text - メッセージテキスト
 * @returns {Date|null} - 抽出された期限日時、なければnull
 */
function extractDueDateFromText(text) {
  if (!text) return null;

  const now = new Date();
  const currentYear = now.getFullYear();

  // パターン1: "11/18" または "2024/11/18"
  const slashDateMatch = text.match(/(\d{4}\/)?(\d{1,2})\/(\d{1,2})/);
  if (slashDateMatch) {
    const year = slashDateMatch[1] ? parseInt(slashDateMatch[1].replace('/', '')) : currentYear;
    const month = parseInt(slashDateMatch[2]);
    const day = parseInt(slashDateMatch[3]);
    
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const dueDate = new Date(year, month - 1, day, 23, 59, 59);
      logger.info(`📅 日付を検出: ${slashDateMatch[0]} → ${dueDate.toLocaleString('ja-JP')}`);
      return dueDate;
    }
  }

  // パターン2: "11月18日" または "11月18日まで"
  const japDateMatch = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (japDateMatch) {
    const month = parseInt(japDateMatch[1]);
    const day = parseInt(japDateMatch[2]);
    
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const dueDate = new Date(currentYear, month - 1, day, 23, 59, 59);
      logger.info(`📅 日付を検出: ${japDateMatch[0]} → ${dueDate.toLocaleString('ja-JP')}`);
      return dueDate;
    }
  }

  // パターン3: "明日"
  if (text.includes('明日')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    logger.info(`📅 相対日付を検出: 明日 → ${tomorrow.toLocaleString('ja-JP')}`);
    return tomorrow;
  }

  // パターン4: "来週"
  if (text.includes('来週')) {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(23, 59, 59, 999);
    logger.info(`📅 相対日付を検出: 来週 → ${nextWeek.toLocaleString('ja-JP')}`);
    return nextWeek;
  }

  return null;
}

module.exports = {
  replaceMentionsWithNames,
  replaceChannelIdsWithNames,
  extractDueDateFromText,
};
