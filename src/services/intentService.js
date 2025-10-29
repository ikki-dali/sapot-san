const OpenAI = require('openai');

// OpenAI クライアント初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 意図の種類
const INTENTS = {
  TASK_REQUEST: 'task_request',       // タスク依頼
  INFORMATION: 'information',          // 情報検索・質問
  REMINDER_SETUP: 'reminder_setup',    // リマインド設定
  REMINDER_CANCEL: 'reminder_cancel',  // リマインドキャンセル
  HELP: 'help'                         // ヘルプ表示
};

/**
 * ユーザーメッセージから意図を判定
 * @param {string} text - ユーザーのメッセージ（メンション除去済み）
 * @returns {Promise<Object>} 判定結果
 */
async function detectIntent(text) {
  try {
    console.log('🔍 意図判定開始:', text);

    // 事前チェック1: リマインドキャンセルキーワードがあれば強制的にreminder_cancel
    const cancelKeywords = ['キャンセル', 'きゃんせる', '中止', 'やめて', '取消', '削除'];
    const reminderKeywords = ['リマインド', 'りまいんど', 'アラート', '通知', '知らせて'];
    const lowerText = text.toLowerCase();

    // キャンセルとリマインドの両方が含まれているか確認
    const hasCancelKeyword = cancelKeywords.some(kw => lowerText.includes(kw.toLowerCase()));
    const hasReminderKeyword = reminderKeywords.some(kw => lowerText.includes(kw.toLowerCase()));

    if (hasCancelKeyword && hasReminderKeyword) {
      console.log(`🚫 リマインドキャンセルを検出 → reminder_cancel に強制判定`);
      return {
        intent: INTENTS.REMINDER_CANCEL,
        confidence: 100,
        reason: 'リマインドキャンセルキーワードが検出されたため',
        originalText: text
      };
    }

    // 事前チェック2: リマインド関連キーワードがあれば強制的にreminder_setup
    for (const keyword of reminderKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        console.log(`🔔 キーワード "${keyword}" を検出 → reminder_setup に強制判定`);
        return {
          intent: INTENTS.REMINDER_SETUP,
          confidence: 100,
          reason: `リマインドキーワード「${keyword}」が検出されたため`,
          originalText: text
        };
      }
    }

    // OpenAI Function Calling を使用して意図を判定
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `あなたはSlackボット「サポ田さん」の意図判定アシスタントです。
ユーザーのメッセージから、以下のいずれかの意図を判定してください：

1. **task_request** (タスク依頼)
   - 誰かに何かをやってもらいたい
   - 自分がやるべきことを記録したい
   - 例: 「資料をまとめてください」「明日までにレポート作成」
   - 注意: 「リマインド」という言葉が含まれている場合は、reminder_setupを選択すること

2. **information** (情報検索・質問)
   - 過去の会話や情報を知りたい
   - 何かについて質問している
   - 例: 「先週の会議で決まったことは？」「このプロジェクトの進捗は？」

3. **reminder_setup** (リマインド設定) ⚠️優先度高⚠️
   - 「リマインド」「通知」「アラート」などのキーワードが含まれている
   - 特定の時刻や間隔で通知してほしい
   - 〇分後、〇時に、毎日、などの時間指定がある
   - 例: 「1分後にリマインドして」「15時にリマインドして」「10分おきにリマインド」「毎日リマインド」
   - 重要: 「リマインド」という単語が含まれていたら、必ずこの意図を選択してください

4. **help** (ヘルプ)
   - 使い方を知りたい
   - 機能を教えてほしい
   - 例: 「使い方は？」「何ができるの？」

判定ルール（優先順位順）:
1. 「リマインド」「通知」「アラート」のキーワードがある → reminder_setup（最優先）
2. 過去の情報や質問 → information
3. タスクの依頼や作業指示 → task_request
4. 使い方や機能説明 → help

確信度も0-100で返してください。`
        },
        {
          role: 'user',
          content: text
        }
      ],
      functions: [
        {
          name: 'classify_intent',
          description: 'ユーザーメッセージの意図を分類する',
          parameters: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                enum: ['task_request', 'information', 'reminder_setup', 'help'],
                description: '検出された意図'
              },
              confidence: {
                type: 'number',
                description: '判定の確信度（0-100）'
              },
              reason: {
                type: 'string',
                description: 'この意図と判定した理由'
              }
            },
            required: ['intent', 'confidence', 'reason']
          }
        }
      ],
      function_call: { name: 'classify_intent' }
    });

    // Function Calling の結果を取得
    const functionCall = response.choices[0].message.function_call;
    const result = JSON.parse(functionCall.arguments);

    console.log('✅ 意図判定完了:', result);

    return {
      intent: result.intent,
      confidence: result.confidence,
      reason: result.reason,
      originalText: text
    };
  } catch (error) {
    console.error('❌ 意図判定エラー:', error.message);

    // エラー時はデフォルトでヘルプを返す
    return {
      intent: INTENTS.HELP,
      confidence: 0,
      reason: 'エラーが発生したため、デフォルトでヘルプを表示します',
      error: error.message
    };
  }
}

/**
 * 意図が指定の閾値を超えているか確認
 * @param {Object} intentResult - detectIntentの結果
 * @param {number} threshold - 確信度の閾値（デフォルト: 70）
 * @returns {boolean}
 */
function isConfident(intentResult, threshold = 70) {
  return intentResult.confidence >= threshold;
}

/**
 * 複数の意図候補を取得（上位N件）
 * 将来的に複数の意図を検討する場合に使用
 * @param {string} text - ユーザーのメッセージ
 * @returns {Promise<Array>} 意図候補の配列
 */
async function detectMultipleIntents(text) {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `ユーザーのメッセージから、可能性のある意図を複数検出してください。
各意図について確信度をつけて、上位3件まで返してください。`
        },
        {
          role: 'user',
          content: text
        }
      ],
      functions: [
        {
          name: 'classify_multiple_intents',
          description: '複数の意図候補を返す',
          parameters: {
            type: 'object',
            properties: {
              intents: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    intent: {
                      type: 'string',
                      enum: ['task_request', 'information', 'reminder_setup', 'help']
                    },
                    confidence: {
                      type: 'number'
                    },
                    reason: {
                      type: 'string'
                    }
                  },
                  required: ['intent', 'confidence', 'reason']
                }
              }
            },
            required: ['intents']
          }
        }
      ],
      function_call: { name: 'classify_multiple_intents' }
    });

    const functionCall = response.choices[0].message.function_call;
    const result = JSON.parse(functionCall.arguments);

    return result.intents;
  } catch (error) {
    console.error('❌ 複数意図判定エラー:', error.message);
    return [];
  }
}

module.exports = {
  INTENTS,
  detectIntent,
  isConfident,
  detectMultipleIntents
};
