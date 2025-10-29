# タスク10: AIサービス層の実装

**フェーズ**: Phase 3 - AI統合
**難易度**: Complex
**推定時間**: 3時間
**依存関係**: タスク9（OpenAI API統合の準備）

## 🎯 目標

Slackスレッドの要約、タスクの優先度判定、担当者提案を行う`src/services/aiService.js`を実装する。

## 📋 背景

OpenAI APIを活用して、以下の機能を実装します：
1. **スレッド要約**: 長いスレッドの内容を簡潔にまとめる
2. **優先度判定**: タスクの緊急度・重要度を自動判定（1: 低、2: 中、3: 高）
3. **担当者提案**: スレッドの内容から適切な担当者を提案（将来用）

## ✅ 実装手順

### チェックリスト
- [ ] `aiService.js`を実装
- [ ] スレッド要約機能を実装
- [ ] 優先度判定機能を実装
- [ ] プロンプトを最適化
- [ ] エラーハンドリングを追加
- [ ] コスト最適化を実施
- [ ] 単体テストを実施

---

### Step 1: `src/services/aiService.js`の実装

```javascript
require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/**
 * Slackスレッドのメッセージを要約
 * @param {Array} messages - Slackメッセージの配列
 * @returns {Promise<string>} 要約文
 */
async function summarizeThread(messages) {
  try {
    // メッセージをテキスト形式に整形
    const threadText = messages
      .map(msg => `[${msg.user}]: ${msg.text}`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `あなたはSlackのスレッドを簡潔に要約するアシスタントです。
重要なポイントを箇条書きでまとめてください。
- 誰が何を依頼したか
- どんな内容か
- 期限や条件があるか

箇条書きは3点以内に収めてください。`
        },
        {
          role: 'user',
          content: `以下のSlackスレッドを要約してください:\n\n${threadText}`
        }
      ],
      max_tokens: 300,
      temperature: 0.3 // 要約なので低めに設定
    });

    const summary = response.choices[0].message.content.trim();
    const tokensUsed = response.usage.total_tokens;

    console.log(`📝 スレッド要約完了（トークン: ${tokensUsed}）`);

    return summary;
  } catch (error) {
    console.error('❌ スレッド要約エラー:', error.message);
    return null; // エラー時はnullを返す（要約なしでタスク作成）
  }
}

/**
 * タスクの優先度を判定
 * @param {string} taskText - タスク内容
 * @param {Date} dueDate - 期限（オプション）
 * @returns {Promise<number>} 優先度（1: 低、2: 中、3: 高）
 */
async function determinePriority(taskText, dueDate = null) {
  try {
    let dueDateInfo = '';
    if (dueDate) {
      const now = new Date();
      const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
      dueDateInfo = `\n期限: ${daysUntilDue}日後`;
    }

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `あなたはタスクの優先度を判定するアシスタントです。
以下の基準で優先度を判定し、数字のみ（1, 2, 3）で回答してください。

- 1（低）: 緊急性が低く、重要度も低い。時間に余裕がある。
- 2（中）: 通常の優先度。期限があるが余裕がある、または重要度が中程度。
- 3（高）: 緊急性が高い、または非常に重要。すぐに対応が必要。

以下のキーワードがあれば優先度を上げる:
- 緊急、至急、ASAP、今日中、明日まで → 3
- 重要、クリティカル、本番、障害 → 3
- お願い、できれば、余裕があれば → 1

必ず1, 2, 3のいずれかの数字のみで回答してください。`
        },
        {
          role: 'user',
          content: `タスク: ${taskText}${dueDateInfo}\n\n優先度を判定してください（1, 2, 3のいずれか）。`
        }
      ],
      max_tokens: 10,
      temperature: 0.1 // 判定なので非常に低く
    });

    const priorityText = response.choices[0].message.content.trim();
    const priority = parseInt(priorityText);

    // 1〜3の範囲外の場合はデフォルト2
    if (![1, 2, 3].includes(priority)) {
      console.log(`⚠️ 優先度判定が不正（${priorityText}）、デフォルト2を使用`);
      return 2;
    }

    console.log(`🎯 優先度判定: ${priority}`);
    return priority;
  } catch (error) {
    console.error('❌ 優先度判定エラー:', error.message);
    return 2; // エラー時はデフォルト2（中）
  }
}

/**
 * タスク内容を整形・補完
 * @param {string} rawText - 元のタスクテキスト
 * @returns {Promise<string>} 整形されたタスクテキスト
 */
async function formatTaskText(rawText) {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `あなたはタスクの内容を明確で簡潔にするアシスタントです。
以下のルールに従ってタスクを整形してください:
- 動詞で始める（例: 「〜を作成」「〜を確認」「〜に連絡」）
- 不要な冗長表現を削除
- 箇条書きや記号は残す
- 元の意味を変えない
- 50文字以内に収める

元のテキストがすでに明確な場合は、そのまま返してください。`
        },
        {
          role: 'user',
          content: `タスク: ${rawText}\n\n整形してください。`
        }
      ],
      max_tokens: 100,
      temperature: 0.3
    });

    const formatted = response.choices[0].message.content.trim();

    console.log(`✏️ タスク整形完了`);
    return formatted;
  } catch (error) {
    console.error('❌ タスク整形エラー:', error.message);
    return rawText; // エラー時は元のテキストをそのまま返す
  }
}

/**
 * スレッドの内容から担当者を提案（将来用）
 * @param {Array} messages - Slackメッセージの配列
 * @param {Array} availableUsers - 利用可能なユーザーリスト
 * @returns {Promise<string|null>} 推奨担当者のユーザーID
 */
async function suggestAssignee(messages, availableUsers = []) {
  try {
    // 将来実装: チームメンバーのスキル・過去のタスクを考慮して提案
    // 現時点ではスレッドで最も言及されているユーザーを返す

    const userMentions = {};
    messages.forEach(msg => {
      const mentions = msg.text.match(/<@([A-Z0-9]+)>/g);
      if (mentions) {
        mentions.forEach(mention => {
          const userId = mention.match(/<@([A-Z0-9]+)>/)[1];
          userMentions[userId] = (userMentions[userId] || 0) + 1;
        });
      }
    });

    if (Object.keys(userMentions).length === 0) {
      return null;
    }

    // 最も言及されているユーザーを返す
    const suggestedUser = Object.entries(userMentions)
      .sort((a, b) => b[1] - a[1])[0][0];

    console.log(`👤 担当者提案: ${suggestedUser}`);
    return suggestedUser;
  } catch (error) {
    console.error('❌ 担当者提案エラー:', error.message);
    return null;
  }
}

/**
 * Slackメッセージ取得のヘルパー
 * @param {Object} slackClient - Slack Boltのclientオブジェクト
 * @param {string} channel - チャンネルID
 * @param {string} threadTs - スレッドタイムスタンプ
 * @returns {Promise<Array>} メッセージ配列
 */
async function fetchThreadMessages(slackClient, channel, threadTs) {
  try {
    const result = await slackClient.conversations.replies({
      channel: channel,
      ts: threadTs,
      limit: 20 // 最大20件
    });

    return result.messages || [];
  } catch (error) {
    console.error('❌ スレッド取得エラー:', error.message);
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
```

### Step 2: テストスクリプトの作成

`test-ai-service.js`:

```javascript
const aiService = require('./src/services/aiService');

async function testAIService() {
  console.log('🤖 AIサービスのテスト開始\n');

  try {
    // 1. スレッド要約テスト
    console.log('1️⃣ スレッド要約テスト');
    const mockMessages = [
      { user: 'U001', text: '来週の資料作成お願いできますか？' },
      { user: 'U002', text: 'かしこまりました。水曜日までに作成します。' },
      { user: 'U001', text: 'ありがとうございます！PDFとPPT両方でお願いします。' }
    ];

    const summary = await aiService.summarizeThread(mockMessages);
    console.log('要約結果:\n', summary);

    // 2. 優先度判定テスト
    console.log('\n2️⃣ 優先度判定テスト');

    const testCases = [
      '資料を作成してください',
      '緊急！本番環境でエラーが発生しています',
      '時間があれば確認お願いします'
    ];

    for (const taskText of testCases) {
      const priority = await aiService.determinePriority(taskText);
      console.log(`タスク: "${taskText}" → 優先度: ${priority}`);
    }

    // 3. タスク整形テスト
    console.log('\n3️⃣ タスク整形テスト');
    const rawText = 'えーと、資料なんですけど作成してもらえたら嬉しいです';
    const formatted = await aiService.formatTaskText(rawText);
    console.log(`元: ${rawText}`);
    console.log(`整形後: ${formatted}`);

    console.log('\n✅ 全テスト完了！');
  } catch (error) {
    console.error('\n❌ テスト失敗:', error.message);
    process.exit(1);
  }
}

testAIService();
```

実行:
```bash
node test-ai-service.js
```

### Step 3: コスト最適化

1. **プロンプトの簡潔化**
   - 不要な説明を削除
   - システムプロンプトを短く

2. **max_tokensの制限**
   - 要約: 300トークン
   - 優先度判定: 10トークン
   - 整形: 100トークン

3. **temperatureの調整**
   - 要約: 0.3（適度な創造性）
   - 優先度判定: 0.1（一貫性重視）
   - 整形: 0.3（適度な創造性）

4. **キャッシングの検討（将来）**
   - 同じスレッドを複数回要約しない
   - 要約結果をデータベースに保存

## 📤 成果物

- ✅ `src/services/aiService.js`が実装されている
- ✅ スレッド要約機能が動作する
- ✅ 優先度判定機能が動作する
- ✅ タスク整形機能が動作する
- ✅ エラーハンドリングが実装されている
- ✅ テストスクリプトが成功する

## 🔍 確認方法

```bash
# テストスクリプトを実行
node test-ai-service.js

# 出力例:
# 📝 スレッド要約完了（トークン: 245）
# 要約結果:
# - U001が資料作成を依頼
# - U002が水曜日までに作成すると回答
# - PDFとPPT形式で納品予定
#
# 🎯 優先度判定: 2
# 🎯 優先度判定: 3
# 🎯 優先度判定: 1
```

## ⚠️ 注意点

1. **エラー時のフォールバック**
   - AI処理が失敗してもタスク作成は続行
   - 要約なし、優先度デフォルト2で作成

2. **プロンプトエンジニアリング**
   - システムプロンプトは慎重に設計
   - 出力形式を明確に指定（数字のみなど）

3. **トークン数の監視**
   - 長いスレッドは要約前に切り詰める
   - max_tokensで出力を制限

4. **レート制限**
   - 短時間に大量のリクエストを送らない
   - リトライ処理を実装

5. **コスト管理**
   - AI機能はオプションとして実装
   - ユーザーがON/OFFできるように

## 🚀 次のステップ

→ [タスク11: AI機能のSlack統合](./task-11-ai-slack-integration.md)
