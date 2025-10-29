# タスク1: データベース選定と環境構築

**フェーズ**: Phase 1 - データベース統合
**難易度**: Simple
**推定時間**: 30分
**依存関係**: なし

## 🎯 目標

Supabaseプロジェクトを作成し、サポ田さんアプリケーションと接続するための環境を整える。

## 📋 背景

現在、サポ田さんはIn-memory Map（メモリ上）でタスクを管理しているため、アプリを再起動するとデータが消失します。データベースを導入することで、タスクを永続化し、本番運用に耐えうるシステムにします。

## ✅ 実装手順

### チェックリスト
- [x] Supabaseプロジェクトを作成
- [x] 接続情報を取得
- [x] 環境変数を設定
- [x] Supabase JSクライアントをインストール
- [x] 接続テストを実行

---

### Step 1: Supabaseプロジェクトの作成

1. **Supabase MCPツールで利用可能な組織を確認**
   ```
   Claude Codeで以下を実行:
   mcp__supabase__list_organizations
   ```

2. **コストを確認**
   ```
   mcp__supabase__get_cost
   パラメータ:
   - type: "project"
   - organization_id: (Step 1で取得したID)
   ```

3. **新しいプロジェクトを作成**
   ```
   mcp__supabase__create_project
   必要な情報:
   - name: "sapot-san"
   - region: "ap-northeast-1" (東京)
   - organization_id: (Step 1で取得したID)
   - confirm_cost_id: (コスト確認後に取得)
   ```

4. **プロジェクトIDとURLを記録**
   作成後、以下の情報を控えておく:
   - Project ID
   - Project URL (例: https://xxxxx.supabase.co)

### Step 2: Supabase接続情報の取得

1. **Anon Keyを取得**
   ```
   mcp__supabase__get_anon_key
   パラメータ: project_id (Step 1で取得)
   ```

2. **Project URLを取得**
   ```
   mcp__supabase__get_project_url
   パラメータ: project_id (Step 1で取得)
   ```

### Step 3: 環境変数の設定

1. `.env.example`を編集して、Supabase関連の環境変数を追加:
   ```env
   # Slack Bot Token（xoxb-で始まる）
   SLACK_BOT_TOKEN=xoxb-your-bot-token-here

   # Slack App Token（xapp-で始まる、Socket Mode用）
   SLACK_APP_TOKEN=xapp-your-app-token-here

   # Slack Signing Secret
   SLACK_SIGNING_SECRET=your-signing-secret-here

   # Supabase
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   ```

2. `.env`ファイルを作成（まだ存在しない場合）:
   ```bash
   cp .env.example .env
   ```

3. 実際の値を`.env`に記入

### Step 4: Supabase JSクライアントのインストール

```bash
npm install @supabase/supabase-js
```

### Step 5: 接続テスト

簡単なテストスクリプトを作成して接続を確認:

`test-supabase-connection.js`を作成:
```javascript
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testConnection() {
  try {
    const { data, error } = await supabase.from('_').select('*').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 = table not found (expected)
      throw error;
    }
    console.log('✅ Supabase接続成功！');
  } catch (error) {
    console.error('❌ Supabase接続失敗:', error.message);
  }
}

testConnection();
```

実行:
```bash
node test-supabase-connection.js
```

## 📤 成果物

- ✅ Supabaseプロジェクトが作成されている
- ✅ `.env`ファイルに接続情報が設定されている
- ✅ `@supabase/supabase-js`がインストールされている
- ✅ 接続テストが成功している

## 🔍 確認方法

```bash
# 環境変数が設定されているか確認
cat .env | grep SUPABASE

# パッケージがインストールされているか確認
npm list @supabase/supabase-js

# 接続テスト実行
node test-supabase-connection.js
```

## ⚠️ 注意点

1. **`.env`ファイルは絶対にGitにコミットしない**
   - `.gitignore`に含まれていることを必ず確認

2. **ANON KEYの使用**
   - Row Level Security (RLS)を適切に設定すれば、ANON KEYで十分
   - 必要に応じてSERVICE ROLE KEYを使用（全権限なので注意）

3. **リージョン選択**
   - ap-northeast-1（東京）を選択することで、日本からのレイテンシーを最小化

## 🚀 次のステップ

→ [タスク2: タスクテーブルのスキーマ設計](./task-02-schema-design.md)
