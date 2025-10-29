const { slackClient } = require('./slackService');

/**
 * ユーザーがアクセス可能なチャンネル一覧を取得
 * @param {string} userId - SlackユーザーID
 * @returns {Promise<Array>} チャンネル情報の配列
 */
async function getUserAccessibleChannels(userId) {
  try {
    console.log(`📋 ユーザー ${userId} のチャンネル一覧を取得中...`);

    const result = await slackClient.users.conversations({
      user: userId,
      types: 'public_channel,private_channel',
      exclude_archived: true,
      limit: 100
    });

    if (!result.ok) {
      throw new Error(`Slack API エラー: ${result.error}`);
    }

    console.log(`✅ ${result.channels.length}件のチャンネルを取得しました`);
    return result.channels;
  } catch (error) {
    console.error('❌ チャンネル一覧取得エラー:', error.message);
    throw error;
  }
}

/**
 * チャンネルの履歴を取得
 * @param {string} channelId - チャンネルID
 * @param {Object} options - オプション
 * @returns {Promise<Array>} メッセージの配列
 */
async function getChannelHistory(channelId, options = {}) {
  try {
    const {
      limit = 100,
      oldest = null,  // UNIX timestamp
      latest = null   // UNIX timestamp
    } = options;

    console.log(`📜 チャンネル ${channelId} の履歴を取得中... (limit: ${limit})`);

    const params = {
      channel: channelId,
      limit: limit
    };

    if (oldest) params.oldest = oldest;
    if (latest) params.latest = latest;

    const result = await slackClient.conversations.history(params);

    if (!result.ok) {
      throw new Error(`Slack API エラー: ${result.error}`);
    }

    console.log(`✅ ${result.messages.length}件のメッセージを取得しました`);
    return result.messages;
  } catch (error) {
    console.error(`❌ チャンネル履歴取得エラー (${channelId}):`, error.message);
    return []; // エラー時は空配列を返す
  }
}

/**
 * スレッドの返信を取得
 * @param {string} channelId - チャンネルID
 * @param {string} threadTs - スレッドのタイムスタンプ
 * @returns {Promise<Array>} 返信メッセージの配列
 */
async function getThreadReplies(channelId, threadTs) {
  try {
    console.log(`💬 スレッド ${threadTs} の返信を取得中...`);

    const result = await slackClient.conversations.replies({
      channel: channelId,
      ts: threadTs
    });

    if (!result.ok) {
      throw new Error(`Slack API エラー: ${result.error}`);
    }

    console.log(`✅ ${result.messages.length}件の返信を取得しました`);
    return result.messages;
  } catch (error) {
    console.error(`❌ スレッド返信取得エラー (${channelId}, ${threadTs}):`, error.message);
    return [];
  }
}

/**
 * キーワードでメッセージを検索（シンプル版）
 * @param {Array} messages - メッセージの配列
 * @param {string} keyword - 検索キーワード
 * @returns {Array} マッチしたメッセージ
 */
function filterMessagesByKeyword(messages, keyword) {
  const lowerKeyword = keyword.toLowerCase();

  return messages.filter(message => {
    const text = (message.text || '').toLowerCase();
    return text.includes(lowerKeyword);
  });
}

/**
 * 複数チャンネルから関連メッセージを検索
 * @param {string} userId - 検索を実行するユーザーID
 * @param {string} query - 検索クエリ
 * @param {Object} options - オプション
 * @returns {Promise<Array>} 検索結果
 */
async function searchAcrossChannels(userId, query, options = {}) {
  try {
    const {
      maxChannels = 10,      // 検索するチャンネル数の上限
      maxMessages = 50,      // チャンネルごとのメッセージ数上限
      daysBack = 30          // 何日前まで検索するか
    } = options;

    console.log(`🔍 複数チャンネル横断検索: "${query}"`);

    // ユーザーがアクセス可能なチャンネルを取得
    const channels = await getUserAccessibleChannels(userId);
    const targetChannels = channels.slice(0, maxChannels);

    console.log(`📂 ${targetChannels.length}件のチャンネルを検索します`);

    // 検索期間を計算（UNIX timestamp）
    const oldest = Math.floor((Date.now() - (daysBack * 24 * 60 * 60 * 1000)) / 1000);

    // 各チャンネルから履歴を取得
    const searchResults = [];

    for (const channel of targetChannels) {
      try {
        // チャンネル履歴を取得
        const messages = await getChannelHistory(channel.id, {
          limit: maxMessages,
          oldest: oldest.toString()
        });

        // キーワードでフィルタ
        const matchedMessages = filterMessagesByKeyword(messages, query);

        // 結果に追加
        for (const message of matchedMessages) {
          searchResults.push({
            channel: {
              id: channel.id,
              name: channel.name || channel.id
            },
            message: {
              text: message.text,
              ts: message.ts,
              user: message.user,
              thread_ts: message.thread_ts
            },
            timestamp: parseInt(message.ts.split('.')[0]) * 1000, // ミリ秒に変換
            relevanceScore: calculateRelevance(message.text, query)
          });
        }
      } catch (error) {
        console.warn(`⚠️ チャンネル ${channel.id} の検索をスキップ:`, error.message);
        continue;
      }
    }

    // 関連度でソート
    searchResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    console.log(`✅ ${searchResults.length}件のマッチを発見しました`);

    return searchResults;
  } catch (error) {
    console.error('❌ 横断検索エラー:', error.message);
    throw error;
  }
}

/**
 * メッセージの関連度を計算（シンプル版）
 * @param {string} text - メッセージテキスト
 * @param {string} query - 検索クエリ
 * @returns {number} 関連度スコア（0-100）
 */
function calculateRelevance(text, query) {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // シンプルなスコアリング
  let score = 0;

  // 完全一致
  if (lowerText.includes(lowerQuery)) {
    score += 50;
  }

  // キーワードの出現回数
  const matches = (lowerText.match(new RegExp(lowerQuery, 'gi')) || []).length;
  score += Math.min(matches * 10, 30);

  // メッセージの長さ（短すぎず長すぎないものを優先）
  const length = text.length;
  if (length > 20 && length < 500) {
    score += 20;
  }

  return Math.min(score, 100);
}

/**
 * 検索結果をフォーマット（表示用）
 * @param {Array} results - 検索結果
 * @param {number} limit - 表示する件数
 * @returns {string} フォーマット済みテキスト
 */
function formatSearchResults(results, limit = 5) {
  if (results.length === 0) {
    return '検索結果が見つかりませんでした。';
  }

  const topResults = results.slice(0, limit);
  let formatted = `🔍 ${results.length}件の結果が見つかりました（上位${topResults.length}件を表示）\n\n`;

  topResults.forEach((result, index) => {
    const date = new Date(result.timestamp).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // メッセージを150文字に切り詰め
    const preview = result.message.text.length > 150
      ? result.message.text.substring(0, 150) + '...'
      : result.message.text;

    formatted += `${index + 1}. *#${result.channel.name}* (${date})\n`;
    formatted += `   ${preview}\n`;
    formatted += `   _関連度: ${result.relevanceScore}%_\n\n`;
  });

  return formatted;
}

module.exports = {
  getUserAccessibleChannels,
  getChannelHistory,
  getThreadReplies,
  filterMessagesByKeyword,
  searchAcrossChannels,
  calculateRelevance,
  formatSearchResults
};
