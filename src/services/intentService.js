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
 * ルールベースで簡単なパターンを高速判定
 * @param {string} text - ユーザーのメッセージ
 * @returns {Object|null} 判定結果、またはnull（AI判定が必要）
 */
function detectIntentByRules(text) {
  const lowerText = text.toLowerCase();

  // 1. リマインドキャンセル判定（最優先）
  const cancelKeywords = ['キャンセル', 'きゃんせる', '中止', 'やめて', '取消', '削除', 'とりけし'];
  const reminderKeywords = ['リマインド', 'りまいんど', 'アラート', '通知', 'つうち', '知らせ'];

  const hasCancelKeyword = cancelKeywords.some(kw => lowerText.includes(kw.toLowerCase()));
  const hasReminderKeyword = reminderKeywords.some(kw => lowerText.includes(kw.toLowerCase()));

  if (hasCancelKeyword && hasReminderKeyword) {
    return {
      intent: INTENTS.REMINDER_CANCEL,
      confidence: 100,
      reason: 'リマインドキャンセルキーワードが検出されたため（ルールベース判定）',
      originalText: text,
      method: 'rule-based'
    };
  }

  // 2. リマインド設定判定（高優先）
  if (hasReminderKeyword) {
    return {
      intent: INTENTS.REMINDER_SETUP,
      confidence: 100,
      reason: `リマインドキーワードが検出されたため（ルールベース判定）`,
      originalText: text,
      method: 'rule-based'
    };
  }

  // 3. ヘルプ判定（明確なパターン）
  const helpPatterns = [
    /^(使い方|つかいかた|ヘルプ|help|使用方法|機能|できること|コマンド)/i,
    /(何ができる|なにができる|どう使う|教えて.*機能)/i
  ];

  for (const pattern of helpPatterns) {
    if (pattern.test(text)) {
      return {
        intent: INTENTS.HELP,
        confidence: 95,
        reason: 'ヘルプ要求パターンを検出（ルールベース判定）',
        originalText: text,
        method: 'rule-based'
      };
    }
  }

  // 4. 情報検索判定（疑問文パターン）
  const questionPatterns = [
    /(.*)(は|って|の)(何|なに|どこ|いつ|誰|だれ|どう|なぜ|どれ)/i,
    /(進捗|状況|ステータス).*(は|どう|教えて)/i,
    /^(いつ|誰が|何を|どこで|なぜ|どうして|どのように)/i
  ];

  for (const pattern of questionPatterns) {
    if (pattern.test(text) && text.includes('?') || text.includes('？')) {
      return {
        intent: INTENTS.INFORMATION,
        confidence: 85,
        reason: '疑問文パターンを検出（ルールベース判定）',
        originalText: text,
        method: 'rule-based'
      };
    }
  }

  // 5. タスク依頼判定（明確な依頼表現）
  const taskPatterns = [
    /(してください|お願いします|やって|作成して|確認して|まとめて)/i,
    /(.*)(までに|まで).*(作る|作成|完成|提出)/i,
    /(急ぎ|至急|緊急).*(お願い|依頼)/i
  ];

  for (const pattern of taskPatterns) {
    if (pattern.test(text)) {
      return {
        intent: INTENTS.TASK_REQUEST,
        confidence: 80,
        reason: 'タスク依頼パターンを検出（ルールベース判定）',
        originalText: text,
        method: 'rule-based'
      };
    }
  }

  // ルールで判定できない場合はnullを返す（AI判定へ）
  return null;
}

/**
 * ユーザーメッセージから意図を判定
 * @param {string} text - ユーザーのメッセージ（メンション除去済み）
 * @param {Array|null} threadContext - スレッドの会話履歴（省略可能）
 * @returns {Promise<Object>} 判定結果
 */
async function detectIntent(text, threadContext = null) {
  try {
    console.log('🔍 意図判定開始:', text);

    // ステップ1: ルールベース判定（高速）
    const ruleResult = detectIntentByRules(text);
    if (ruleResult) {
      console.log('⚡ ルールベース判定で決定:', ruleResult.intent, `(確信度: ${ruleResult.confidence}%)`);
      return ruleResult;
    }

    // ステップ2: AI判定（精度重視）
    console.log('🤖 AI判定にフォールバック...');

    // スレッドコンテキストの準備
    const messages = [
      {
        role: 'system',
        content: `あなたはSlackボット「サポ田さん」の意図判定アシスタントです。
ユーザーのメッセージから、最も適切な意図を1つ判定してください。

## 意図の種類

### 1. task_request (タスク依頼)
**特徴:**
- 誰かに何かをやってもらいたい
- 依頼・指示・お願いの表現
- 期限や担当者の指定がある場合も多い

**判定基準:**
- 「〜してください」「〜お願いします」「〜やって」
- 「〜を作成」「〜を確認」「〜をまとめる」
- 期限表現: 「明日までに」「今週中に」「急ぎで」

### 2. information (情報検索・質問)
**特徴:**
- 過去の情報を知りたい
- 状態や進捗を確認したい
- 疑問形での質問

**判定基準:**
- 「〜は？」「〜ですか？」「教えて」
- 「進捗」「状況」「どうなった」
- 「いつ」「誰が」「何を」「どこで」「なぜ」

### 3. reminder_setup (リマインド設定) ⚠️ 最優先 ⚠️
**特徴:**
- 時間を指定した通知依頼
- 定期的な通知の設定

**判定基準（これらの単語があれば確実にreminder_setup）:**
- 「リマインド」「通知」「アラート」「知らせて」「思い出させて」
- 時間表現: 「〇分後」「〇時に」「毎日」「毎週」「〇分おきに」

### 4. help (ヘルプ)
**特徴:**
- ボットの使い方を知りたい
- 機能説明を求めている

**判定基準:**
- 「使い方」「ヘルプ」「何ができる」「機能」「コマンド」

## 判定の優先順位
1. リマインド関連キーワード → reminder_setup（最優先）
2. 疑問詞 + 過去の情報 → information
3. 依頼・指示表現 → task_request
4. 使い方・機能 → help

## Few-shot Examples

**Example 1:**
入力: "明日の会議資料を作成してください"
出力: {"intent": "task_request", "confidence": 95, "reason": "依頼表現「〜してください」とタスク「資料を作成」が明確"}

**Example 2:**
入力: "先週の会議で決まったことは？"
出力: {"intent": "information", "confidence": 90, "reason": "過去の情報を求める疑問文"}

**Example 3:**
入力: "30分後にリマインドして"
出力: {"intent": "reminder_setup", "confidence": 100, "reason": "「リマインド」キーワードと時間指定あり"}

**Example 4:**
入力: "1分後に通知してください"
出力: {"intent": "reminder_setup", "confidence": 100, "reason": "「通知」キーワードと時間指定あり"}

**Example 5:**
入力: "この機能の使い方を教えて"
出力: {"intent": "help", "confidence": 85, "reason": "「使い方」キーワードで機能説明を求めている"}

**Example 6:**
入力: "プロジェクトの進捗はどうですか？"
出力: {"intent": "information", "confidence": 90, "reason": "進捗状況を確認する質問"}

**Example 7:**
入力: "毎日9時にスタンドアップをリマインド"
出力: {"intent": "reminder_setup", "confidence": 100, "reason": "「リマインド」キーワードと定期実行の指定あり"}

**Example 8:**
入力: "レポートを今週中に完成させてね"
出力: {"intent": "task_request", "confidence": 90, "reason": "期限付きのタスク依頼"}

## 重要な注意事項
- 「リマインド」「通知」「アラート」「知らせて」があれば**必ず**reminder_setup
- 確信度は客観的に: 明確なら90-100、やや不明確なら70-89、曖昧なら50-69`
      }
    ];

    // スレッドコンテキストがある場合は追加（会話履歴を考慮）
    if (threadContext && Array.isArray(threadContext) && threadContext.length > 0) {
      console.log(`📚 スレッドコンテキスト追加: ${threadContext.length}件のメッセージ`);

      // 会話履歴を整形して追加
      const contextText = threadContext.map((msg, idx) => {
        const author = msg.user ? `<@${msg.user}>` : 'システム';
        return `${idx + 1}. ${author}: ${msg.text}`;
      }).join('\n');

      messages.push({
        role: 'user',
        content: `以下は、現在のスレッドの会話履歴です。この文脈を考慮して、次のメッセージの意図を判定してください。\n\n【会話履歴】\n${contextText}\n\n【判定対象メッセージ】\n${text}`
      });
    } else {
      // コンテキストがない場合は通常通り
      messages.push({
        role: 'user',
        content: text
      });
    }

    // OpenAI Function Calling を使用して意図を判定
    // gpt-4o-mini: より速く、コストが1/15、インテント判定には十分
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_INTENT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: messages,
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

    console.log('✅ AI判定完了:', result);

    return {
      intent: result.intent,
      confidence: result.confidence,
      reason: result.reason + '（AI判定）',
      originalText: text,
      method: 'ai'
    };
  } catch (error) {
    console.error('❌ 意図判定エラー:', error.message);

    // エラー時はヘルプ意図で返す
    return {
      intent: INTENTS.HELP,
      confidence: 50,
      reason: `エラーが発生したため、デフォルトでヘルプを表示します: ${error.message}`,
      originalText: text,
      error: error.message,
      method: 'fallback'
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
