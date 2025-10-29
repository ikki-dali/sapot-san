# シンプルAIアシスタント機能 設計書

## 📋 概要

@サポ田さんメンションを拡張し、タスク管理だけでなく、情報検索やリマインド設定など、より柔軟なAIアシスタント機能を提供します。

## 🎯 目標

1. **Slack内情報検索・回答** - ワークスペース内の会話から情報を探して回答
2. **柔軟なリマインド設定** - 自然言語でリマインドを設定
3. **既存のタスク管理機能との統合** - 現在の機能を損なわない

## 🏗️ システム設計

### 1. 意図（Intent）判定システム

@サポ田さんへのメンションテキストを解析し、ユーザーの意図を判定：

```javascript
const intents = {
  TASK_REQUEST: 'task_request',      // タスク依頼
  INFORMATION: 'information',         // 情報検索・質問
  REMINDER_SETUP: 'reminder_setup',   // リマインド設定
  HELP: 'help'                        // ヘルプ表示
};
```

#### 判定例

| ユーザーの発言 | 意図 |
|------------|------|
| 「資料をまとめてください」 | TASK_REQUEST |
| 「先週の会議で決まったことは？」 | INFORMATION |
| 「15時にリマインドして」 | REMINDER_SETUP |
| 「山本さんに10分おきにリマインドして」 | REMINDER_SETUP |
| 「使い方を教えて」 | HELP |

### 2. 機能詳細

#### 2-1. 情報検索・回答機能

**目的**: Slackワークスペース内の会話から関連情報を検索し、AIで整理して回答

**実装手順**:

1. **チャンネル履歴取得**
   - Slack Web API `conversations.history`を使用
   - 対象チャンネル: ユーザーがアクセス可能なチャンネル
   - 取得期間: 直近30日分（設定可能）

2. **関連情報の検索**
   - キーワードマッチング
   - ベクトル検索（オプション: OpenAI Embeddings）
   - 検索範囲: メッセージテキスト、スレッド、添付ファイル名

3. **AI回答生成**
   - OpenAI GPT-4を使用
   - プロンプト例:
   ```
   あなたはSlackワークスペースの情報アシスタントです。
   以下の会話履歴から、ユーザーの質問に答えてください。

   質問: {user_question}

   関連する会話:
   {relevant_messages}

   回答は簡潔に、出典（チャンネル名、日時、投稿者）を明記してください。
   ```

4. **回答フォーマット**
   ```
   📚 見つかった情報をお伝えします！

   {AI生成の回答}

   📍 出典:
   - #general (2025-10-25 14:30) by @山本さん
   - #dev-team (2025-10-24 10:15) by @田中さん

   💡 他に知りたいことがあればお気軽に聞いてください！
   ```

**制限事項**:
- プライベートチャンネルはボットが参加しているもののみ
- 検索コストを考慮し、1回の検索で最大50件のメッセージまで
- API制限に注意（Slack APIのレート制限）

#### 2-2. リマインド設定機能

**目的**: 自然言語でリマインドを柔軟に設定

**設定パターン**:

1. **特定時刻リマインド**
   - 例: 「15時にリマインドして」「明日の10時にリマインドして」
   - 実装: `node-cron`または`node-schedule`を使用

2. **定期リマインド（特定ユーザー宛）**
   - 例: 「@山本さんに10分おきにリマインドして」
   - 実装: `setInterval`またはcronジョブ

3. **相対時間リマインド**
   - 例: 「30分後にリマインドして」「1時間後にリマインドして」
   - 実装: `setTimeout`

**パース処理**:

```javascript
// 自然言語からリマインド情報を抽出
async function parseReminderRequest(text) {
  // OpenAI Function Callingを使用して構造化データに変換
  const reminderInfo = await aiService.extractReminderInfo(text);

  return {
    type: 'once' | 'recurring',  // 1回のみ or 定期
    targetUser: 'U12345',         // 対象ユーザーID（省略時は依頼者）
    timing: {
      type: 'absolute' | 'relative' | 'interval',
      value: '15:00' | 30 | 10,  // 時刻 or 分数
      unit: 'minutes' | 'hours'
    },
    message: '元のメッセージ',
    channel: 'C12345',
    threadTs: '1234567890.123456'
  };
}
```

**データベーススキーマ**:

```sql
CREATE TABLE reminders (
  id SERIAL PRIMARY KEY,
  reminder_type VARCHAR(20) NOT NULL,  -- 'once', 'recurring'
  target_user VARCHAR(50) NOT NULL,
  created_by VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  channel VARCHAR(50) NOT NULL,
  thread_ts VARCHAR(50),

  -- タイミング情報
  schedule_type VARCHAR(20) NOT NULL,  -- 'absolute', 'relative', 'interval'
  schedule_time TIMESTAMP,             -- 絶対時刻
  interval_minutes INT,                 -- 繰り返し間隔（分）

  -- 状態管理
  status VARCHAR(20) DEFAULT 'active',  -- 'active', 'completed', 'cancelled'
  last_reminded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- メタデータ
  metadata JSONB                        -- 追加情報
);
```

**リマインド実行**:

```javascript
// 定期実行（1分ごとにチェック）
cron.schedule('* * * * *', async () => {
  // 実行すべきリマインドを取得
  const dueReminders = await getRemindersDue();

  for (const reminder of dueReminders) {
    // Slackに通知
    await client.chat.postMessage({
      channel: reminder.channel,
      thread_ts: reminder.thread_ts,
      text: `🔔 リマインド: <@${reminder.target_user}>\n\n${reminder.message}`
    });

    // ステータス更新
    if (reminder.reminder_type === 'once') {
      await updateReminderStatus(reminder.id, 'completed');
    } else {
      await updateLastReminded(reminder.id, new Date());
    }
  }
});
```

**キャンセル機能**:

```
@サポ田さん リマインドをキャンセル
→ 現在有効なリマインドを一覧表示
→ ボタンでキャンセル選択
```

### 3. 統合フロー

```
@サポ田さん [メッセージ]
    ↓
1. 意図判定 (AI)
    ↓
    ├─ TASK_REQUEST → 既存のタスク作成フロー
    ├─ INFORMATION → 情報検索 → AI回答
    ├─ REMINDER_SETUP → リマインド設定
    └─ HELP → ヘルプメッセージ
```

### 4. ファイル構成

```
src/
├── services/
│   ├── aiService.js           # 既存（拡張）
│   ├── intentService.js       # NEW: 意図判定
│   ├── searchService.js       # NEW: Slack検索
│   └── reminderService.js     # NEW: リマインド管理
├── handlers/
│   └── mentionHandler.js      # NEW: メンション処理を分離
└── models/
    └── Reminder.js            # NEW: リマインドモデル
```

## 📝 実装順序

### Phase 1: 基盤整備
1. ✅ 設計ドキュメント作成（このファイル）
2. ⬜ 意図判定サービス実装 (`intentService.js`)
3. ⬜ データベーステーブル作成（remindersテーブル）

### Phase 2: 情報検索機能
4. ⬜ Slack検索サービス実装 (`searchService.js`)
5. ⬜ AI回答生成機能実装 (`aiService.js`拡張)
6. ⬜ メンションハンドラー更新（情報検索対応）

### Phase 3: リマインド機能
7. ⬜ リマインドサービス実装 (`reminderService.js`)
8. ⬜ 自然言語パース機能実装
9. ⬜ リマインド実行cronジョブ実装
10. ⬜ キャンセル機能実装

### Phase 4: テスト・調整
11. ⬜ 統合テスト
12. ⬜ ユーザーフィードバック収集
13. ⬜ パフォーマンス最適化

## 🔐 セキュリティ考慮事項

1. **アクセス制御**
   - ユーザーがアクセスできないチャンネルの情報は検索しない
   - プライベートチャンネルの情報を他チャンネルに漏らさない

2. **レート制限**
   - Slack API呼び出しを適切に制限
   - OpenAI APIコストを管理

3. **データ保護**
   - リマインドデータは暗号化して保存
   - 完了したリマインドは定期的にアーカイブ

## 💰 コスト見積もり

### OpenAI API コスト（GPT-4）

- **意図判定**: ~$0.001/リクエスト（100トークン程度）
- **情報検索回答**: ~$0.01/リクエスト（1000トークン程度）
- **リマインドパース**: ~$0.002/リクエスト（200トークン程度）

**月間見積もり（100ユーザー、各機能10回/日使用）**:
- 意図判定: 100人 × 30日 × 10回 × $0.001 = $30
- 情報検索: 100人 × 30日 × 5回 × $0.01 = $150
- リマインド: 100人 × 30日 × 3回 × $0.002 = $18

**合計: 約$200/月**

### Slack API制限

- Tier 2: 100+ requests/分
- 現在の使用量を考慮すると、追加機能でも制限内に収まる見込み

## 🚀 次のステップ

1. この設計書をレビュー
2. ユーザーからのフィードバック収集
3. Phase 1の実装開始

---

**作成日**: 2025-10-29
**作成者**: Claude Code + ikki
**バージョン**: 1.0
