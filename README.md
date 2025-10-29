# サポ田さん - Slack タスク管理アシスタント

Slackの会話から自動でタスク化し、未返信の依頼も逃さないAIアシスタントです。

## ✨ 主な機能

### 基本機能（実装済み）
- ✅ リアクション（✅または📝）でタスク作成
- ✅ `/task-list` コマンドでタスク一覧表示
- ✅ `/task-done [ID]` コマンドでタスク完了
- ✅ `@サポ田さん` メンションでヘルプ表示

### AI機能（実装済み）
- 🤖 スレッドの自動要約
- 🤖 タスクの優先度自動判定
- 🤖 タスク内容の自動整形
- 🤖 担当者の自動提案

### 期限管理・リマインド（実装済み）
- ⏰ タスクに期限（due_date）を設定
- ⏰ 期限が近いタスクを自動通知
- ⏰ 期限切れタスクのアラート
- ⏰ 定期的なリマインド

### 未返信メッセージ検知（実装済み）
- 🔍 メンションされたが返信がないメッセージを検知
- 🔍 24時間以上未返信のメッセージを自動タスク化

### Webポータル（実装済み）
- 🌐 REST API サーバー
- 🌐 タスク管理ダッシュボード
- 🌐 リアルタイム統計表示
- 🌐 タスク完了機能

### Notion連携（実装済み）
- 📝 Notionデータベースとの双方向同期
- 📝 15分ごとの自動同期
- 📝 タスクの作成・更新・完了を双方向で反映

### Google Calendar連携（実装済み）
- 🗓️ タスクの期限をGoogle Calendarイベントとして自動作成
- 🗓️ タスク更新時にイベント自動更新
- 🗓️ 優先度別カラー表示（高=赤、中=黄、低=緑）
- 🗓️ 30分ごとの自動同期

## 🚀 セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env` ファイルを作成し、以下の内容を設定：

```env
# Slack設定（必須）
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_SIGNING_SECRET=your-signing-secret

# Supabase設定（必須）
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# OpenAI API設定（必須）
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o

# Notion連携（オプション）
NOTION_API_KEY=secret_your_notion_integration_token
NOTION_DATABASE_ID=your_notion_database_id
```

### 3. Notion連携設定（オプション）

詳細は後述の「Notion連携の設定」セクションを参照してください。

## 💻 起動方法

### Slack Bot（メインアプリ）

```bash
npm start       # 本番起動
npm run dev     # 開発モード（自動リロード）
```

### APIサーバー + Webダッシュボード

```bash
npm run server      # APIサーバー起動
npm run server:dev  # 開発モード
```

起動後、ブラウザで http://localhost:3000 にアクセス

## 🧪 テスト

```bash
npm test              # 全テスト実行
npm run test:watch    # 監視モード
npm run test:coverage # カバレッジレポート生成
```

**テスト結果**: 74テスト / 100%合格 ✅

## 📚 使用技術

- **Node.js** - サーバーサイド
- **@slack/bolt** - Slack Bot フレームワーク
- **Express** - Web APIサーバー
- **Supabase** - データベース
- **OpenAI API** - AI機能
- **Winston** - ログ管理
- **Jest** - テストフレームワーク
- **@notionhq/client** - Notion API
- **node-cron** - 定期実行
- **Bootstrap** - Webダッシュボード UI

## 🔌 API エンドポイント

### タスク管理

- `GET /api/tasks` - タスク一覧取得
- `GET /api/tasks/:taskId` - 単一タスク取得
- `POST /api/tasks` - タスク作成
- `PUT /api/tasks/:taskId` - タスク更新
- `POST /api/tasks/:taskId/complete` - タスク完了
- `DELETE /api/tasks/:taskId` - タスク削除
- `GET /api/tasks/upcoming` - 期限が近いタスク取得

### 統計情報

- `GET /api/stats/dashboard` - ダッシュボード統計
- `GET /api/stats/trend?days=7` - タスク完了率の推移

## 📝 Notion連携の設定

### Step 1: Notion Integrationを作成

1. https://www.notion.so/my-integrations にアクセス
2. 「+ New integration」をクリック
3. 名前を「サポ田さん」に設定
4. 「Submit」をクリック
5. 「Internal Integration Token」をコピー → `.env`の`NOTION_API_KEY`に設定

### Step 2: Notionデータベースを作成

1. Notionで新しいデータベースを作成
2. 以下のプロパティを追加：
   - **タスク名** (タイトル)
   - **ステータス** (セレクト: 未着手, 進行中, 完了)
   - **優先度** (セレクト: 高, 中, 低)
   - **タスクID** (テキスト)
   - **担当者** (テキスト)
   - **期限** (日付)
   - **完了日** (日付)

3. データベースの右上「...」→「Copy link to view」
4. URLから`https://notion.so/xxxxxxxxxxxx?v=yyyyy`の`xxxxxxxxxxxx`部分をコピー
5. `.env`の`NOTION_DATABASE_ID`に設定

### Step 3: データベースにIntegrationを招待

1. データベース右上「...」→「Connections」
2. 作成したIntegration「サポ田さん」を選択
3. 「Confirm」をクリック

これで設定完了！15分ごとに自動で双方向同期されます。

## 🗓️ Google Calendar連携の設定

### Step 1: Google Cloud Projectを作成

1. https://console.cloud.google.com/ にアクセス
2. 新しいプロジェクトを作成（例：「sapot-san」）
3. プロジェクトを選択

### Step 2: Google Calendar APIを有効化

1. 左メニュー → 「APIとサービス」→「ライブラリ」
2. 「Google Calendar API」を検索
3. 「有効にする」をクリック

### Step 3: Service Accountを作成

1. 左メニュー → 「APIとサービス」→「認証情報」
2. 「認証情報を作成」→「サービスアカウント」を選択
3. サービスアカウント名を入力（例：「sapot-san-calendar」）
4. 「作成して続行」をクリック
5. ロールは不要なのでスキップ → 「完了」

### Step 4: 認証情報JSONをダウンロード

1. 作成したサービスアカウントをクリック
2. 「キー」タブ → 「鍵を追加」→「新しい鍵を作成」
3. 「JSON」を選択 → 「作成」
4. JSONファイルがダウンロードされる

### Step 5: .envに設定

1. ダウンロードしたJSONファイルの内容を1行にまとめる：
   ```bash
   cat downloaded-file.json | jq -c
   ```

2. `.env`に追加：
   ```env
   GOOGLE_CALENDAR_CREDENTIALS={"type":"service_account","project_id":"..."...}
   GOOGLE_CALENDAR_ID=your-calendar-id@gmail.com
   ```

   カレンダーIDの確認方法：
   - Google Calendarを開く
   - 使用するカレンダーの設定 → 「カレンダーの統合」
   - 「カレンダーID」をコピー
   - プライマリカレンダーの場合は自分のGmailアドレス

### Step 6: カレンダーにService Accountを招待

1. Google Calendarを開く
2. 使用するカレンダーの設定 → 「特定のユーザーとの共有」
3. Service AccountのメールアドレスCLIENT_EMAIL（JSONファイル内の`client_email`）を追加
4. 権限を「予定の変更権限」に設定
5. 「送信」

これで設定完了！30分ごとに自動で同期されます。

## 📄 ライセンス

ISC
