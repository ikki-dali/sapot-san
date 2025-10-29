# サポ田さん - Slack タスク管理アシスタント開発ガイド

## 📋 プロジェクト概要

Slackの会話から自動でタスク化し、未返信の依頼も逃さないAIアシスタント「サポ田さん」の開発プロジェクトです。

## 🎯 現在の実装状況

### ✅ 実装済み（v1.0 - MVP）
- リアクション（✅または📝）でタスク作成
- `/task-list` コマンドでタスク一覧表示
- `/task-done [ID]` コマンドでタスク完了
- `@サポ田さん` メンションでヘルプ表示
- In-memoryでのタスク管理（Map使用）

### 🚧 未実装（優先度順）

#### 1. データベース統合（最優先）
- [ ] PostgreSQLまたはMongoDBの導入
- [ ] タスクの永続化
- [ ] マイグレーションファイルの作成
- [ ] 接続プーリングの実装

#### 2. 期限管理とリマインド
- [ ] タスクに期限（due_date）を設定する機能
- [ ] 期限が近いタスクを自動通知
- [ ] 期限切れタスクのアラート
- [ ] リマインド頻度の設定

#### 3. 未返信メッセージの自動検知
- [ ] メンションされたが返信がないメッセージを検知
- [ ] 24時間以上未返信のメッセージをタスク化
- [ ] 自動タスク化のON/OFF設定

#### 4. AI統合（OpenAI API）
- [ ] スレッドの要約機能
- [ ] タスクの優先度自動判定
- [ ] 担当者の自動提案
- [ ] タスク内容の自動整形

#### 5. Webポータル（React）
- [ ] タスク一覧・編集画面
- [ ] カンバンボード形式の表示
- [ ] フィルタリング・検索機能
- [ ] ダッシュボード（統計表示）

#### 6. Notion連携
- [ ] Notionデータベースとの同期
- [ ] 双方向でのタスク作成・更新
- [ ] Notion側からのタスク完了

## 🏗️ アーキテクチャ

```
sapot-san/
├── app.js                 # メインアプリケーション
├── package.json           # 依存関係
├── .env                   # 環境変数（Git管理外）
├── .env.example           # 環境変数テンプレート
├── README.md             # ドキュメント
├── src/
│   ├── handlers/         # イベントハンドラー
│   │   ├── reactions.js  # リアクションイベント
│   │   ├── commands.js   # スラッシュコマンド
│   │   └── mentions.js   # メンションイベント
│   ├── services/         # ビジネスロジック
│   │   ├── taskService.js    # タスク管理
│   │   ├── reminderService.js # リマインド
│   │   └── aiService.js      # AI機能
│   ├── models/           # データモデル
│   │   └── Task.js       # タスクモデル
│   ├── db/              # データベース
│   │   ├── connection.js # DB接続
│   │   └── migrations/   # マイグレーション
│   └── utils/           # ユーティリティ
│       ├── logger.js    # ログ管理
│       └── helpers.js   # ヘルパー関数
└── web/                 # Webポータル（将来）
    ├── public/
    └── src/
```

## 💻 開発時の注意点

### コーディング規約
- **ES6+** の構文を使用
- **async/await** で非同期処理
- **エラーハンドリング** を必ず実装（try-catch）
- **ログ出力** で動作を追跡可能に
- **コメント** は日本語でわかりやすく

### Slack API の制約
- `ack()` は **3秒以内** に必ず呼ぶ
- レート制限に注意（Tier 2: 100+ req/min）
- Socket Mode推奨（開発時）
- 本番はEvent Subscriptionsを使用

### セキュリティ
- `.env` ファイルは **絶対にGitにコミットしない**
- トークンは環境変数で管理
- 入力値は必ずバリデーション
- SQLインジェクション対策（Prepared Statements使用）

## 🔧 開発コマンド

```bash
# 開発サーバー起動（ファイル変更を自動検知）
npm run dev

# 本番起動
npm start

# テスト実行（未実装）
npm test

# リント（未実装）
npm run lint
```

## 📝 次に実装すべき機能の詳細

### 1. データベース統合

**タスク**: PostgreSQLまたはMongoDBを導入し、タスクを永続化する

**実装手順**:
1. `pg`（PostgreSQL）または`mongoose`（MongoDB）をインストール
   ```bash
   npm install pg
   # または
   npm install mongoose
   ```

2. `src/db/connection.js` を作成
   ```javascript
   // PostgreSQLの例
   const { Pool } = require('pg');
   
   const pool = new Pool({
     host: process.env.DB_HOST,
     port: process.env.DB_PORT,
     database: process.env.DB_NAME,
     user: process.env.DB_USER,
     password: process.env.DB_PASSWORD,
   });
   
   module.exports = pool;
   ```

3. タスクテーブルのスキーマ設計
   ```sql
   CREATE TABLE tasks (
     id SERIAL PRIMARY KEY,
     task_id VARCHAR(255) UNIQUE NOT NULL,
     text TEXT NOT NULL,
     channel VARCHAR(255) NOT NULL,
     message_ts VARCHAR(255) NOT NULL,
     created_by VARCHAR(255) NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     status VARCHAR(50) DEFAULT 'open',
     assignee VARCHAR(255),
     due_date TIMESTAMP,
     completed_at TIMESTAMP,
     completed_by VARCHAR(255)
   );
   ```

4. `app.js` の `tasks Map` をDB操作に置き換え

**重要**: マイグレーションファイルを作成し、DB構造をバージョン管理すること

### 2. 期限管理とリマインド

**タスク**: タスクに期限を設定し、自動リマインドを実装

**実装手順**:
1. タスク作成時に期限を設定できるモーダルを追加
   ```javascript
   app.shortcut('create_task_with_deadline', async ({ ack, body, client }) => {
     await ack();
     // モーダルを開く処理
   });
   ```

2. `node-cron` を使った定期実行
   ```bash
   npm install node-cron
   ```

3. 毎日決まった時間にチェック
   ```javascript
   const cron = require('node-cron');
   
   // 毎日9時に実行
   cron.schedule('0 9 * * *', async () => {
     // 期限が近いタスクを通知
   });
   ```

### 3. AI統合（OpenAI API）

**タスク**: スレッドを要約し、タスクの重要度を判定

**実装手順**:
1. OpenAI SDKをインストール
   ```bash
   npm install openai
   ```

2. `src/services/aiService.js` を作成
   ```javascript
   const OpenAI = require('openai');
   
   const openai = new OpenAI({
     apiKey: process.env.OPENAI_API_KEY,
   });
   
   async function summarizeThread(messages) {
     const response = await openai.chat.completions.create({
       model: "gpt-4",
       messages: [{
         role: "system",
         content: "あなたはSlackのスレッドを要約するアシスタントです。"
       }, {
         role: "user",
         content: `以下のスレッドを要約してください:\n${messages}`
       }]
     });
     return response.choices[0].message.content;
   }
   ```

3. タスク作成時に自動で要約を追加

## 🐛 既知の問題

- [ ] In-memory Mapのため、再起動でデータ消失
- [ ] エラーハンドリングが不十分
- [ ] ログ管理が未実装
- [ ] テストコードがない

## 📚 参考リンク

- [Slack Bolt for JavaScript](https://slack.dev/bolt-js/)
- [Slack API Documentation](https://api.slack.com/)
- [OpenAI API Documentation](https://platform.openai.com/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## 🎓 学習ポイント

### Slack Bolt フレームワーク
- `app.event()`: Slackイベント（メッセージ、リアクションなど）をリスン
- `app.command()`: スラッシュコマンドを処理
- `app.shortcut()`: ショートカットやモーダルアクションを処理
- `ack()`: Slackに応答確認を送信（3秒以内必須）

### 非同期処理
- `async/await` を使って読みやすいコードに
- `Promise.all()` で複数の非同期処理を並列実行
- エラーは必ず `try-catch` でキャッチ

### データベース設計
- 正規化を意識したテーブル設計
- インデックスでクエリを高速化
- トランザクションで整合性を保つ

## 💡 開発Tips

1. **Socket Modeを使う**: 開発時はngrokなどの設定不要で便利
2. **ログを充実させる**: `console.log` だけでなく、適切なロガーを使用
3. **環境変数を活用**: 設定値はハードコードせず、`.env` で管理
4. **小さく始める**: 一度に全部作らず、機能を一つずつ実装してテスト

## 🚀 デプロイ

### Heroku（おすすめ）
```bash
# Heroku CLIインストール後
heroku create sapot-san
heroku config:set SLACK_BOT_TOKEN=xoxb-...
heroku config:set SLACK_APP_TOKEN=xapp-...
heroku config:set SLACK_SIGNING_SECRET=...
git push heroku main
```

### AWS Lambda + DynamoDB
- コストを抑えたい場合に最適
- Serverless Frameworkを使用すると簡単

## 📞 サポート

質問や問題があれば、Claude Codeで相談してください！