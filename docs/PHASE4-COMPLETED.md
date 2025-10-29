# Phase 4: 未返信メッセージ検知 - 完了レポート

**完了日時**: 2025年10月29日
**所要時間**: 約40分
**実装者**: Claude Code with User

## 🎉 実装完了タスク

### ✅ タスク8: 未返信メッセージの自動検知機能

- [x] Supabaseに未返信追跡テーブルを作成 (`unreplied_mentions`)
- [x] `src/services/unrepliedService.js` を実装
  - メンション記録機能
  - 返信検知機能
  - 未返信メッセージ取得機能
  - 自動タスク化機能
  - 統計取得機能
- [x] `app.js`にイベントハンドラーを追加
  - `app_mention`: メンションを記録
  - `message`: スレッド返信を検知
- [x] cronジョブに未返信チェックを追加
  - 毎日10:00に24時間以上未返信のメッセージを自動タスク化
- [x] 動作確認完了

## 📊 データベーススキーマ

### `unreplied_mentions` テーブル

```sql
CREATE TABLE unreplied_mentions (
  id BIGSERIAL PRIMARY KEY,
  channel VARCHAR(255) NOT NULL,
  message_ts VARCHAR(255) NOT NULL,
  mentioned_user VARCHAR(255) NOT NULL,
  mentioner_user VARCHAR(255) NOT NULL,
  message_text TEXT NOT NULL,
  mentioned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  replied_at TIMESTAMP WITH TIME ZONE,
  auto_tasked BOOLEAN DEFAULT FALSE,
  task_id VARCHAR(255),
  UNIQUE(channel, message_ts, mentioned_user)
);
```

**インデックス**:
- `idx_unreplied_channel`: チャンネル検索を高速化
- `idx_unreplied_user`: ユーザー検索を高速化
- `idx_unreplied_status`: 未返信メッセージ検索を高速化
- `idx_unreplied_auto_tasked`: 未タスク化メッセージ検索を高速化

## 🚀 実装された機能

### 1. メンション記録機能

**トリガー**: `@サポ田さん` とメンション

**動作**:
```
ユーザー: @サポ田さん これお願いします
  ↓
サポ田さん:
「こんにちは！サポ田さんです 👋

タスク管理のお手伝いをします！
• ✅ や :memo: のリアクションでタスク作成
• `/task-list` でタスク一覧表示
• `/task-done [タスクID]` でタスク完了
• ⚡ショートカット「Create Task with Deadline」で期限付きタスク作成

💡 このメッセージに24時間以上返信がない場合、自動的にタスク化されます。」
  ↓
データベースに記録:
- channel: C123456
- message_ts: 1698567890.123456
- mentioned_user: U123456 (メンションしたユーザー)
- message_text: "@サポ田さん これお願いします"
- mentioned_at: 2025-10-29 10:30:00
- replied_at: NULL (未返信)
- auto_tasked: false
```

### 2. 返信検知機能

**トリガー**: スレッドに返信

**動作**:
```
ユーザーがスレッドに返信
  ↓
データベース更新:
- replied_at: 2025-10-29 11:00:00 (返信時刻)
  ↓
未返信状態が解除される
→ 自動タスク化の対象外になる
```

### 3. 自動タスク化機能

**トリガー**: 毎日 10:00 (cron)

**動作フロー**:
```
1. 未返信メッセージをチェック
   - replied_at が NULL
   - auto_tasked が false
   - mentioned_at が 24時間以上前

2. 該当するメッセージを自動タスク化
   - タスク作成: 「【未返信】元のメッセージ内容」
   - 優先度: 🟡 中
   - 担当者: メンションしたユーザー

3. Slackに通知
   「⚠️ 24時間以上返信がないため、自動的にタスク化しました

   *タスクID:* task_1234567890123
   *担当:* @山本
   *優先度:* 🟡 中

   完了したら `/task-done task_1234567890123` を実行してください。」

4. データベース更新
   - auto_tasked: true
   - task_id: task_1234567890123
```

### 4. 統計取得機能

**関数**: `getUnrepliedStats()`

**返り値**:
```javascript
{
  unreplied: 5,      // 未返信メッセージ数
  autoTasked: 12,    // 自動タスク化済み数
  replied: 48,       // 返信済み数
  total: 65          // 総メンション数
}
```

## 🛠️ 技術実装

### `unrepliedService.js`の主要関数

1. **`recordMention(mentionData)`**
   - メンションを記録
   - 重複チェック（UNIQUE制約）
   - エラーが起きてもアプリは継続

2. **`markAsReplied(channel, threadTs, userId)`**
   - スレッド返信を検知
   - `replied_at`を更新
   - 未返信状態を解除

3. **`getUnrepliedMentions(hoursThreshold)`**
   - 指定時間以上未返信のメッセージを取得
   - デフォルト: 24時間
   - ソート: 古い順

4. **`autoCreateTask(mention)`**
   - タスクを自動作成
   - タスクテキスト: `【未返信】{元のメッセージ}`
   - データベース更新（auto_tasked = true）

5. **`checkAndAutoTaskUnreplied(slackClient, hoursThreshold)`**
   - cronジョブから定期実行
   - 未返信メッセージをチェック
   - 自動タスク化 + Slack通知

6. **`getUnrepliedStats()`**
   - 未返信統計を取得
   - ダッシュボード表示用

### イベントハンドラー

**`app_mention`イベント**:
```javascript
app.event('app_mention', async ({ event, client }) => {
  // メンション記録
  await unrepliedService.recordMention({
    channel: event.channel,
    messageTs: event.ts,
    mentionedUser: event.user,
    mentionerUser: event.user,
    text: event.text
  });

  // 応答メッセージ送信
  await client.chat.postMessage({...});
});
```

**`message`イベント**:
```javascript
app.event('message', async ({ event }) => {
  // スレッド返信のみ対象（ボット除外）
  if (event.thread_ts && event.thread_ts !== event.ts && !event.bot_id) {
    await unrepliedService.markAsReplied(
      event.channel,
      event.thread_ts,
      event.user
    );
  }
});
```

### cronジョブ

**`reminderService.js`に追加**:
```javascript
// 毎日午前10時に未返信メッセージチェック（24時間以上）
cron.schedule('0 10 * * *', () => {
  console.log('🔔 [定期実行] 未返信メッセージ自動タスク化チェック');
  unrepliedService.checkAndAutoTaskUnreplied(slackClient, 24);
}, {
  timezone: 'Asia/Tokyo'
});
```

## 📝 ファイル構成

```
sapot-san/
├── migrations/
│   └── 002_create_unreplied_mentions_table.sql  # 新規作成
├── src/
│   └── services/
│       ├── unrepliedService.js                   # 新規作成
│       └── reminderService.js                    # 修正（cron追加）
├── app.js                                         # 修正（イベント追加）
├── test-unreplied-table.js                        # 新規作成
└── docs/
    ├── task-08-unreplied-detection.md
    └── PHASE4-COMPLETED.md                        # このファイル
```

## ⚙️ 設定と調整

### 未返信判定時間の変更

`.env`に設定を追加（オプション）:
```env
# 未返信メッセージの自動タスク化
UNREPLIED_THRESHOLD_HOURS=24  # デフォルト: 24時間
```

`reminderService.js`で使用:
```javascript
const threshold = process.env.UNREPLIED_THRESHOLD_HOURS || 24;
unrepliedService.checkAndAutoTaskUnreplied(slackClient, threshold);
```

### cronスケジュールの変更

**現在**: 毎日 10:00
**変更例**:
- 2時間ごと: `'0 */2 * * *'`
- 毎日 9:00 と 17:00: 2つのcronジョブを作成

## 🧪 テスト方法

### 1. メンション記録テスト

Slackでサポ田さんにメンション:
```
@サポ田さん テストメッセージ
```

データベース確認:
```javascript
node -e "
  const { supabase } = require('./src/db/connection');
  (async () => {
    const { data } = await supabase
      .from('unreplied_mentions')
      .select('*')
      .order('mentioned_at', { ascending: false })
      .limit(5);
    console.log('最新のメンション記録:', data);
  })();
"
```

### 2. 返信検知テスト

メンションしたスレッドに返信:
```
了解しました！
```

データベース確認（`replied_at`が更新されているはず）

### 3. 自動タスク化テスト（手動実行）

テストスクリプトを作成:
```javascript
// test-unreplied-autotask.js
require('dotenv').config();
const { App } = require('@slack/bolt');
const unrepliedService = require('./src/services/unrepliedService');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

(async () => {
  await app.start();
  console.log('🔍 未返信メッセージチェック（テスト用: 0.01時間 = 36秒）');

  // 36秒以上前のメッセージをチェック
  await unrepliedService.checkAndAutoTaskUnreplied(app.client, 0.01);

  console.log('✅ テスト完了');
  process.exit(0);
})();
```

実行:
```bash
node test-unreplied-autotask.js
```

## ⚠️ 注意点と制約

### 1. メンション対象の解釈

現在の実装では:
- `mentioned_user = event.user` (メンションを**した**ユーザー)
- つまり、自分がサポ田さんにメンションしたら、自分宛のタスクになる

**将来的な拡張案**:
- メッセージ内で別のユーザーをメンション (@山本さん、これお願いします)
- そのユーザーを`mentioned_user`に設定
- より柔軟なタスク割り当て

### 2. ボット自身の投稿除外

`message`イベントで`!event.bot_id`チェックを実装済み
→ ボット自身の返信は返信としてカウントされない

### 3. 重複記録の防止

UNIQUE制約: `(channel, message_ts, mentioned_user)`
→ 同じメッセージへの複数回の記録を防止

### 4. エラーハンドリング

- メンション記録失敗 → ログ出力のみ、アプリは継続
- 返信記録失敗 → ログ出力のみ、アプリは継続
- 自動タスク化失敗 → ログ出力、次のメッセージの処理を継続

### 5. パフォーマンス

- インデックスによる高速検索
- cronジョブは1日1回のみ（負荷軽減）
- バッチ処理で複数メッセージを効率的に処理

## 📊 使用シナリオ

### シナリオ1: 依頼を忘れない

```
10:30 田中さん: @サポ田さん 明日の会議資料作成お願いします
10:31 サポ田さん: 了解しました！24時間以上返信がない場合...
  ↓ 24時間経過、返信なし
翌日10:00 サポ田さん: ⚠️ 24時間以上返信がないため自動タスク化
  ↓
田中さんのタスク一覧に追加
田中さん: 忘れてた！ありがとう！
```

### シナリオ2: 返信があればタスク化されない

```
10:30 山本さん: @サポ田さん データ分析お願いします
10:31 サポ田さん: 了解しました！24時間以上返信がない場合...
15:00 山本さん: 分析完了しました！
  ↓ replied_at更新
  ↓ 自動タスク化の対象外
翌日10:00 （何も起きない）
```

### シナリオ3: 複数の未返信を一括処理

```
Day 1:
- メンション A (未返信)
- メンション B (未返信)
- メンション C (返信済み)

Day 2 10:00:
→ A を自動タスク化 ✅
→ B を自動タスク化 ✅
→ C はスキップ（返信済み）
```

## 🎯 Phase 4の達成状況

| タスク | ステータス | 備考 |
|--------|-----------|------|
| タスク8: 未返信メッセージ検知 | ✅ 完了 | データベース、サービス、イベント、cron全て実装 |

**Phase 4: 未返信メッセージ検知 - 100% 完了！** 🎉

## 🚀 次のステップ

Phase 4完了により、サポ田さんは以下の機能を持つようになりました:
- ✅ データベース永続化（Phase 1）
- ✅ 期限管理とリマインダー（Phase 2）
- ✅ AI自動要約・優先度判定（Phase 3）
- ✅ 未返信メッセージ自動検知（Phase 4）

**残りのフェーズ**:
- **Phase 5**: 品質向上（タスク12-14）
  - タスク12: ログ管理システム（winston導入）
  - タスク13: エラーハンドリング強化
  - タスク14: テストコード作成（Jest）
- **Phase 6**: 将来的な拡張（タスク15-16）
  - タスク15: Webポータル（React + Next.js）
  - タスク16: Notion連携

**現在のアプリ状態**:
```
✅ Supabase接続成功
⚡️ サポ田さんが起動しました！
✅ リマインダーcronジョブを開始しました
  - 毎時 0分: 2-3時間以内の期限タスク通知
  - 毎日 9:00: 24時間以内の期限タスク通知
  - 毎日 10:00: 未返信メッセージ自動タスク化 ⭐NEW
  - 毎日 18:00: 期限切れタスク通知
```

次は **Phase 5: 品質向上** に進みましょう！
