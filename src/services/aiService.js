const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Slackスレッドを要約する
 * @param {Array} messages - スレッドのメッセージ配列 [{text, user, ts}, ...]
 * @returns {Promise<string>} 要約されたテキスト
 */
async function summarizeThread(messages) {
  try {
    if (!messages || messages.length === 0) {
      return 'スレッドが空です';
    }

    // メッセージを整形
    const threadText = messages.map((msg, idx) => {
      return `[${idx + 1}] ${msg.user}: ${msg.text}`;
    }).join('\n');

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'あなたはSlackのスレッドを簡潔に要約するアシスタントです。重要なポイントを箇条書きで2-3点にまとめてください。'
        },
        {
          role: 'user',
          content: `以下のSlackスレッドを要約してください:\n\n${threadText}`
        }
      ],
      max_tokens: 300,
      temperature: 0.3
    });

    const summary = response.choices[0].message.content;
    console.log(`📝 スレッド要約完了 (${messages.length}メッセージ)`);

    return summary;
  } catch (error) {
    console.error('❌ スレッド要約エラー:', error.message);
    return 'スレッドの要約に失敗しました';
  }
}

/**
 * タスクの優先度を自動判定する
 * @param {string} taskText - タスクの内容
 * @param {Date|null} dueDate - 期限日（任意）
 * @returns {Promise<number>} 優先度 (1=高, 2=中, 3=低)
 */
async function determinePriority(taskText, dueDate = null) {
  try {
    // 期限が近い場合は自動的に優先度を上げる
    if (dueDate) {
      const hoursUntilDue = (new Date(dueDate) - new Date()) / (1000 * 60 * 60);

      if (hoursUntilDue <= 24) {
        console.log('⚡ 期限が近いため優先度を「高」に設定');
        return 1; // 24時間以内なら高優先度
      } else if (hoursUntilDue <= 72) {
        console.log('⏰ 期限が近いため優先度を「中」に設定');
        return 2; // 3日以内なら中優先度
      }
    }

    // AIでタスク内容から優先度を判定
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'あなたはタスクの優先度を判定するアシスタントです。以下のタスクを分析し、優先度を1（高）、2（中）、3（低）のいずれかで答えてください。数字のみを返してください。\n\n判定基準:\n- 高(1): 緊急、重要、影響範囲が大きい、バグ修正、セキュリティ\n- 中(2): 通常の業務、機能追加、改善\n- 低(3): 軽微な改善、将来的な検討事項'
        },
        {
          role: 'user',
          content: `タスク: ${taskText}`
        }
      ],
      max_tokens: 10,
      temperature: 0.1
    });

    const priorityText = response.choices[0].message.content.trim();
    const priority = parseInt(priorityText);

    if ([1, 2, 3].includes(priority)) {
      const priorityLabel = { 1: '高', 2: '中', 3: '低' }[priority];
      console.log(`🎯 優先度判定: ${priorityLabel} (${priority})`);
      return priority;
    } else {
      console.log('⚠️ 優先度判定に失敗、デフォルト値(中)を使用');
      return 2; // デフォルトは中優先度
    }
  } catch (error) {
    console.error('❌ 優先度判定エラー:', error.message);
    return 2; // エラー時は中優先度
  }
}

/**
 * タスクのテキストを整形・クリーニングする
 * @param {string} rawText - 生のテキスト
 * @returns {Promise<string>} 整形されたテキスト
 */
async function formatTaskText(rawText) {
  try {
    if (!rawText || rawText.trim().length === 0) {
      return '（タスク内容なし）';
    }

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'あなたはタスク内容を整形するアシスタントです。入力されたテキストを簡潔で明確なタスク内容に整形してください。不要な情報は削除し、重要な内容だけを残してください。1-2文で簡潔にまとめてください。'
        },
        {
          role: 'user',
          content: rawText
        }
      ],
      max_tokens: 100,
      temperature: 0.3
    });

    const formatted = response.choices[0].message.content.trim();
    console.log('✨ タスクテキスト整形完了');

    return formatted;
  } catch (error) {
    console.error('❌ テキスト整形エラー:', error.message);
    return rawText; // エラー時は元のテキストを返す
  }
}

/**
 * スレッドから担当者を提案する
 * @param {Array} messages - スレッドのメッセージ配列 [{text, user, ts}, ...]
 * @returns {Promise<string|null>} 提案された担当者のユーザーID（Slack ID）
 */
async function suggestAssignee(messages) {
  try {
    if (!messages || messages.length === 0) {
      return null;
    }

    // シンプルな実装: 最も多く発言しているユーザーを提案
    const userCounts = {};

    messages.forEach(msg => {
      if (msg.user) {
        userCounts[msg.user] = (userCounts[msg.user] || 0) + 1;
      }
    });

    // 発言回数でソート
    const sortedUsers = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1]);

    if (sortedUsers.length > 0) {
      const suggestedUser = sortedUsers[0][0];
      console.log(`👤 担当者提案: ${suggestedUser} (発言回数: ${sortedUsers[0][1]})`);
      return suggestedUser;
    }

    return null;
  } catch (error) {
    console.error('❌ 担当者提案エラー:', error.message);
    return null;
  }
}

/**
 * Slackスレッドのメッセージを取得する（ヘルパー関数）
 * @param {Object} slackClient - Slack Boltのclientオブジェクト
 * @param {string} channel - チャンネルID
 * @param {string} threadTs - スレッドのタイムスタンプ
 * @returns {Promise<Array>} メッセージ配列 [{text, user, ts}, ...]
 */
async function fetchThreadMessages(slackClient, channel, threadTs) {
  try {
    const result = await slackClient.conversations.replies({
      channel: channel,
      ts: threadTs
    });

    if (!result.messages || result.messages.length === 0) {
      return [];
    }

    // 必要な情報だけを抽出
    const messages = result.messages.map(msg => ({
      text: msg.text,
      user: msg.user,
      ts: msg.ts
    }));

    console.log(`📬 スレッドメッセージ取得: ${messages.length}件`);
    return messages;
  } catch (error) {
    console.error('❌ スレッドメッセージ取得エラー:', error.message);
    return [];
  }
}

module.exports = {
  summarizeThread,
  determinePriority,
  formatTaskText,
  suggestAssignee,
  fetchThreadMessages
};
