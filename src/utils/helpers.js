/**
 * メッセージ内のSlackメンションIDをユーザー名に置換
 * @param {string} text - 元のメッセージテキスト（例: "<@U09CAH6FZPW> サポ田さんの確認お願いします。"）
 * @param {Object} client - Slack Web API クライアント
 * @returns {Promise<string>} - 置換後のテキスト（例: "@山本 一気 サポ田さんの確認お願いします。"）
 */
async function replaceMentionsWithNames(text, client) {
  if (!text) return text;

  // <@U12345> のようなメンションを抽出
  const mentionRegex = /<@([A-Z0-9]+)>/g;
  const matches = [...text.matchAll(mentionRegex)];

  if (matches.length === 0) {
    return text; // メンションがない場合はそのまま返す
  }

  let replacedText = text;

  // 各メンションIDをユーザー名に置換
  for (const match of matches) {
    const userId = match[1];
    const mentionTag = match[0]; // <@U12345>

    try {
      // Slack APIでユーザー情報を取得
      const userInfo = await client.users.info({ user: userId });
      
      if (userInfo.ok && userInfo.user) {
        // 実名（real_name）または表示名（display_name）を使用
        const userName = userInfo.user.profile.real_name || 
                        userInfo.user.profile.display_name || 
                        userInfo.user.name;
        
        // メンションを @ユーザー名 に置換
        replacedText = replacedText.replace(mentionTag, `@${userName}`);
      }
    } catch (error) {
      console.error(`ユーザー情報取得エラー (${userId}):`, error.message);
      // エラーの場合はIDのまま残す
    }
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

  for (const match of matches) {
    const channelId = match[1];
    const channelTag = match[0];

    try {
      const channelInfo = await client.conversations.info({ channel: channelId });
      
      if (channelInfo.ok && channelInfo.channel) {
        const channelName = channelInfo.channel.name;
        replacedText = replacedText.replace(channelTag, `#${channelName}`);
      }
    } catch (error) {
      console.error(`チャンネル情報取得エラー (${channelId}):`, error.message);
    }
  }

  return replacedText;
}

module.exports = {
  replaceMentionsWithNames,
  replaceChannelIdsWithNames,
};
