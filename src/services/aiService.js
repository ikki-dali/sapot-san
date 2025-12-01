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

/**
 * メッセージがタスク依頼かどうかをAIで判定する
 * @param {string} messageText - メッセージテキスト
 * @returns {Promise<{isTask: boolean, confidence: number}>} タスクかどうかと確信度(0-100)
 */
async function analyzeTaskRequest(messageText) {
  try {
    if (!messageText || messageText.trim().length === 0) {
      return { isTask: false, confidence: 0 };
    }

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `あなたはSlackメッセージを分析し、それがタスク依頼かどうかを判定するアシスタントです。

以下のような場合は「タスク」と判定してください:
- 明確な依頼や指示（「〜してください」「〜をお願いします」「〜を作成して」など）
- 期限付きの作業依頼（「明日までに〜」「今週中に〜」など）
- ToDo形式の内容（「〜する必要がある」「〜をやる」など）
- バグ修正や問題解決の依頼

以下のような場合は「タスクではない」と判定してください:
- 単なる質問や相談（「〜について教えて」「〜はどう思う？」など）
- 情報共有や報告（「〜しました」「〜になっています」など）
- 挨拶や雑談（「おはようございます」「こんにちは」など）
- ヘルプの要求（「使い方は？」など）
- **欠席連絡・休暇連絡**（「欠席します」「休みます」「お休みします」「お休みをいただきます」など）
- **遅刻・遅延連絡**（「遅れます」「遅刻します」「遅延してしまい」「○分遅れます」「○分ほど遅れてしまいそうです」など）
- **不在通知**（「不在です」「外出中です」「外出します」「帰宅しました」など）
- **確認・質問**（「〜ですか？」「〜について教えて」「〜はありますか？」など）
- **情報共有のみ**（「〜になりました」「〜の件、了解しました」など）
- **状況報告**（「電車が遅延」「バスが遅れている」「到着が遅れます」など）

必ずJSON形式で回答してください:
{
  "isTask": true/false,
  "confidence": 0-100の数値,
  "reason": "判定理由"
}`
        },
        {
          role: 'user',
          content: `以下のメッセージを分析してください:\n\n${messageText}`
        }
      ],
      max_tokens: 150,
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    console.log(`🤖 タスク判定: ${result.isTask ? 'タスク' : 'タスクではない'} (確信度: ${result.confidence}%) - ${result.reason}`);

    return {
      isTask: result.isTask === true,
      confidence: result.confidence || 0,
      reason: result.reason || ''
    };
  } catch (error) {
    console.error('❌ タスク判定エラー:', error.message);
    return { isTask: false, confidence: 0, reason: 'エラー' };
  }
}

/**
 * タスクメッセージから情報を抽出する
 * @param {string} messageText - メッセージテキスト
 * @returns {Promise<{title: string, dueDate: string|null, priority: number}>}
 */
async function extractTaskInfo(messageText) {
  try {
    if (!messageText || messageText.trim().length === 0) {
      return { title: '（タスク内容なし）', dueDate: null, priority: 2 };
    }

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `あなたはタスク情報を抽出するアシスタントです。
メッセージから以下の情報を抽出してください:

1. タスクタイトル: 簡潔で明確なタスク内容（1-2文）
2. 期限: メッセージに期限が含まれている場合はISO8601形式で抽出（例: 2024-12-31T23:59:59+09:00）
   - 「明日」「今日」などの相対的な表現も解釈してください
   - 時刻が指定されていない場合は23:59:59を使用してください
   - 期限の記載がない場合はnull
3. 優先度: 1(高), 2(中), 3(低)のいずれか

現在の日時: ${new Date().toISOString()}
タイムゾーン: Asia/Tokyo (JST, UTC+9)

必ずJSON形式で回答してください:
{
  "title": "タスクタイトル",
  "dueDate": "ISO8601形式の日時 or null",
  "priority": 1-3の数値
}`
        },
        {
          role: 'user',
          content: `以下のメッセージからタスク情報を抽出してください:\n\n${messageText}`
        }
      ],
      max_tokens: 200,
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    console.log(`📝 タスク情報抽出: タイトル="${result.title}", 期限=${result.dueDate}, 優先度=${result.priority}`);

    return {
      title: result.title || messageText.substring(0, 100),
      dueDate: result.dueDate || null,
      priority: [1, 2, 3].includes(result.priority) ? result.priority : 2
    };
  } catch (error) {
    console.error('❌ タスク情報抽出エラー:', error.message);
    return {
      title: messageText.substring(0, 100),
      dueDate: null,
      priority: 2
    };
  }
}

/**
 * 検索結果からAI回答を生成
 * @param {string} question - ユーザーの質問
 * @param {Array} searchResults - searchServiceからの検索結果
 * @returns {Promise<Object>} AI生成の回答と出典
 */
async function generateAnswerFromSearch(question, searchResults) {
  try {
    console.log(`🤖 AI回答生成開始: "${question}"`);

    if (!searchResults || searchResults.length === 0) {
      return {
        answer: '申し訳ございません。関連する情報が見つかりませんでした。\n\n別のキーワードで質問していただくか、より具体的な質問をしていただけますか？',
        sources: [],
        confidence: 0
      };
    }

    // 検索結果を整形（上位5件まで）
    const topResults = searchResults.slice(0, 5);
    const contextText = topResults.map((result, index) => {
      const date = new Date(result.timestamp).toLocaleDateString('ja-JP');
      return `[${index + 1}] チャンネル: #${result.channel.name} (${date})\n内容: ${result.message.text}\n`;
    }).join('\n');

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `あなたはSlackワークスペースの情報アシスタントです。
ユーザーの質問に対して、提供された過去の会話履歴から正確で簡潔な回答を作成してください。

回答の際の注意点：
- 情報は提供された会話履歴のみを参照してください
- 推測や想像で回答しないでください
- 回答は日本語で、簡潔かつわかりやすく
- 回答の最後に出典（どのチャンネルの情報か）を明記してください`
        },
        {
          role: 'user',
          content: `質問: ${question}\n\n関連する過去の会話:\n${contextText}\n\n上記の情報から質問に答えてください。`
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    });

    const answer = response.choices[0].message.content;

    // 出典情報を抽出
    const sources = topResults.map(result => ({
      channel: result.channel.name,
      date: new Date(result.timestamp).toLocaleDateString('ja-JP'),
      preview: result.message.text.substring(0, 100) + '...'
    }));

    console.log(`✅ AI回答生成完了 (${sources.length}件の出典)`);

    return {
      answer,
      sources,
      confidence: topResults.length > 0 ? Math.min(topResults[0].relevanceScore, 90) : 0
    };
  } catch (error) {
    console.error('❌ AI回答生成エラー:', error.message);
    return {
      answer: 'AIによる回答生成中にエラーが発生しました。しばらくしてから再度お試しください。',
      sources: [],
      confidence: 0,
      error: error.message
    };
  }
}

/**
 * リマインド要求を自然言語から解析
 * @param {string} text - ユーザーの入力テキスト
 * @param {string} requestUserId - 要求したユーザーのID
 * @returns {Promise<Object>} パース結果
 */
async function parseReminderRequest(text, requestUserId) {
  try {
    console.log(`🔍 リマインド要求をパース中: "${text}"`);

    const now = new Date();
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `あなたはリマインド要求を解析するアシスタントです。
ユーザーの自然言語の入力から、リマインド情報を抽出してください。

現在の日時: ${now.toISOString()}
タイムゾーン: Asia/Tokyo (JST, UTC+9)

抽出する情報:
1. reminderMessage: リマインドするメッセージ内容
2. targetUserId: 対象ユーザーのSlack ID（メンション形式 <@U123ABC> から抽出、なければrequestUserIdを使用）
3. scheduleType: スケジュールタイプ
   - "relative": 相対時間（例: 30分後、1時間後）
   - "absolute": 絶対時刻（例: 明日15時、2024-12-31 23:59）
   - "interval": 繰り返し間隔（例: 毎日10時、毎週月曜9時）
4. scheduleTime: 絶対時刻の場合のISO8601形式の日時
5. relativeMinutes: 相対時間の場合の分数
6. intervalMinutes: 繰り返し間隔の場合の分数
7. reminderType: "once"（1回のみ）または "recurring"（定期）
8. confidence: 解析の確信度（0-100）

注意:
- 時刻が指定されていない場合は現在時刻を使用
- 「毎日」は24時間間隔（1440分）
- 「毎週」は1週間間隔（10080分）
- 「毎時」は60分間隔

必ずJSON形式で回答してください:
{
  "reminderMessage": "リマインドメッセージ",
  "targetUserId": "Slack User ID or null",
  "scheduleType": "relative | absolute | interval",
  "scheduleTime": "ISO8601形式 or null",
  "relativeMinutes": 数値 or null,
  "intervalMinutes": 数値 or null,
  "reminderType": "once | recurring",
  "confidence": 0-100の数値,
  "reason": "解析理由"
}`
        },
        {
          role: 'user',
          content: `リクエストユーザーID: ${requestUserId}\n\n以下のテキストからリマインド情報を抽出してください:\n\n${text}`
        }
      ],
      max_tokens: 300,
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);

    // デフォルト値を設定
    const parsedResult = {
      reminderMessage: result.reminderMessage || text,
      targetUserId: result.targetUserId || requestUserId,
      scheduleType: result.scheduleType || 'relative',
      scheduleTime: result.scheduleTime || null,
      relativeMinutes: result.relativeMinutes || null,
      intervalMinutes: result.intervalMinutes || null,
      reminderType: result.reminderType || 'once',
      confidence: result.confidence || 0,
      reason: result.reason || ''
    };

    console.log(`✅ リマインド要求パース完了:`);
    console.log(`   メッセージ: "${parsedResult.reminderMessage}"`);
    console.log(`   対象ユーザー: ${parsedResult.targetUserId}`);
    console.log(`   スケジュール: ${parsedResult.scheduleType}`);
    console.log(`   タイプ: ${parsedResult.reminderType}`);
    console.log(`   確信度: ${parsedResult.confidence}%`);

    return parsedResult;
  } catch (error) {
    console.error('❌ リマインド要求パースエラー:', error.message);
    return {
      reminderMessage: text,
      targetUserId: requestUserId,
      scheduleType: 'relative',
      relativeMinutes: 30, // デフォルト30分後
      reminderType: 'once',
      confidence: 0,
      error: error.message
    };
  }
}

/**
 * 一般的な質問にAIが直接回答する（スレッドコンテキスト考慮）
 * @param {string} question - ユーザーの質問
 * @param {Array} threadMessages - スレッドの会話履歴 [{text, user, ts}, ...]（オプション）
 * @returns {Promise<string>} AIの回答
 */
async function answerDirectQuestion(question, threadMessages = []) {
  try {
    console.log('🤖 AI直接回答を生成中...');

    const messages = [
      {
        role: 'system',
        content: `あなたは「サポ田さん」という名前のSlackボットです。
チームのタスク管理やコミュニケーションをサポートする、頼れるアシスタントとして振る舞ってください。

【回答スタイル】
- 簡潔で分かりやすく（2-3段落程度）
- 専門用語は避け、必要な場合は説明を添える
- フレンドリーで親しみやすいトーン
- 日本語で回答

【スレッドコンテキスト】
- このスレッド内の過去の会話を参照して、文脈に沿った回答をしてください
- 前の質問への回答との一貫性を保つ
- 同じ内容を繰り返し説明しない（「先ほどお伝えしたように〜」と参照する）

【禁止事項】
- Slack全体の履歴（このスレッド外の会話）には言及しない
- 不確かな情報を断定しない
- 長すぎる回答は避ける

質問に対して、役立つ情報を提供してください。`
      }
    ];

    // スレッドの会話履歴をコンテキストとして追加
    if (threadMessages && threadMessages.length > 0) {
      console.log(`📚 スレッドコンテキストを考慮: ${threadMessages.length}件のメッセージ`);

      // 最新10件の会話を取得（長すぎるとトークン制限に引っかかる）
      const recentMessages = threadMessages.slice(-10);

      // 会話履歴をOpenAI形式に変換
      recentMessages.forEach(msg => {
        // ボット自身の発言はassistant、それ以外はuser
        const role = msg.user === 'bot' || msg.bot_id ? 'assistant' : 'user';
        messages.push({
          role: role,
          content: `${msg.user}: ${msg.text}`
        });
      });
    }

    // 最新の質問を追加
    messages.push({
      role: 'user',
      content: question
    });

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: messages,
      max_tokens: 500,
      temperature: 0.7
    });

    const answer = response.choices[0].message.content;
    console.log(`✅ AI直接回答生成完了 (${answer.length}文字, コンテキスト: ${threadMessages.length}件)`);

    return answer;
  } catch (error) {
    console.error('❌ AI直接回答エラー:', error.message);
    return '申し訳ありません、回答の生成中にエラーが発生しました。もう一度お試しいただけますか？';
  }
}

module.exports = {
  summarizeThread,
  determinePriority,
  formatTaskText,
  suggestAssignee,
  fetchThreadMessages,
  analyzeTaskRequest,
  extractTaskInfo,
  generateAnswerFromSearch,
  parseReminderRequest,
  answerDirectQuestion
};
