const { WebClient } = require('@slack/web-api');

// Slack Web APIクライアントを初期化
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

// ユーザー情報のキャッシュ
const userCache = new Map();

// チャンネル情報のキャッシュ
const channelCache = new Map();

/**
 * チャンネル情報を取得（キャッシュ付き）
 * @param {string} channelId - SlackチャンネルID
 * @returns {Promise<Object>} チャンネル情報
 */
async function getChannelInfo(channelId) {
  try {
    // キャッシュから取得
    if (channelCache.has(channelId)) {
      return channelCache.get(channelId);
    }

    // Slack APIから取得
    const result = await slackClient.conversations.info({ channel: channelId });

    if (result.ok && result.channel) {
      const channelInfo = {
        id: channelId,
        name: result.channel.name || channelId,
        is_private: result.channel.is_private || false
      };

      // キャッシュに保存（1時間）
      channelCache.set(channelId, channelInfo);
      setTimeout(() => channelCache.delete(channelId), 60 * 60 * 1000);

      return channelInfo;
    }

    // 取得失敗時はIDをそのまま返す
    return { id: channelId, name: channelId, is_private: false };
  } catch (error) {
    console.error(`⚠️ チャンネル情報取得エラー (${channelId}):`, error.message);
    // エラー時はIDをそのまま返す
    return { id: channelId, name: channelId, is_private: false };
  }
}

/**
 * 複数のチャンネル情報を一括取得
 * @param {Array<string>} channelIds - チャンネルIDの配列
 * @returns {Promise<Object>} チャンネルID => チャンネル情報のマップ
 */
async function getChannelsInfo(channelIds) {
  const uniqueIds = [...new Set(channelIds)];
  const results = {};

  await Promise.all(
    uniqueIds.map(async (channelId) => {
      results[channelId] = await getChannelInfo(channelId);
    })
  );

  return results;
}

/**
 * ユーザー情報を取得（キャッシュ付き）
 * @param {string} userId - SlackユーザーID
 * @returns {Promise<Object>} ユーザー情報
 */
async function getUserInfo(userId) {
  try {
    // キャッシュから取得
    if (userCache.has(userId)) {
      return userCache.get(userId);
    }

    // Slack APIから取得
    const result = await slackClient.users.info({ user: userId });

    if (result.ok && result.user) {
      const userInfo = {
        id: userId,
        name: result.user.real_name || result.user.name || userId,
        display_name: result.user.profile?.display_name || result.user.name || userId,
        email: result.user.profile?.email || null
      };

      // キャッシュに保存（1時間）
      userCache.set(userId, userInfo);
      setTimeout(() => userCache.delete(userId), 60 * 60 * 1000);

      return userInfo;
    }

    // 取得失敗時はIDをそのまま返す
    return { id: userId, name: userId, display_name: userId, email: null };
  } catch (error) {
    console.error(`⚠️ ユーザー情報取得エラー (${userId}):`, error.message);
    // エラー時はIDをそのまま返す
    return { id: userId, name: userId, display_name: userId, email: null };
  }
}

/**
 * 複数のユーザー情報を一括取得
 * @param {Array<string>} userIds - ユーザーIDの配列
 * @returns {Promise<Object>} ユーザーID => ユーザー情報のマップ
 */
async function getUsersInfo(userIds) {
  const uniqueIds = [...new Set(userIds)];
  const results = {};

  await Promise.all(
    uniqueIds.map(async (userId) => {
      results[userId] = await getUserInfo(userId);
    })
  );

  return results;
}

module.exports = {
  getUserInfo,
  getUsersInfo,
  getChannelInfo,
  getChannelsInfo,
  slackClient
};
