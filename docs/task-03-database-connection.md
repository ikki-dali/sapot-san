# タスク3: データベース接続モジュールの実装

**フェーズ**: Phase 1 - データベース統合
**難易度**: Simple
**推定時間**: 30分
**依存関係**: タスク1（データベース選定）、タスク2（スキーマ設計）

## 🎯 目標

Supabaseへの接続を管理する再利用可能なモジュール`src/db/connection.js`を作成する。

## 📋 背景

アプリケーション全体で使用するデータベース接続を一元管理します。環境変数から設定を読み込み、接続プールを効率的に管理します。

## ✅ 実装手順

### チェックリスト
- [x] `src/db`ディレクトリを作成
- [x] `connection.js`を実装
- [x] エラーハンドリングを追加
- [x] 接続テストを実行

---

### Step 1: ディレクトリ構造の作成

```bash
mkdir -p src/db
```

### Step 2: `src/db/connection.js`の実装

```javascript
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Supabaseクライアントの作成
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false // サーバーサイドなのでセッション永続化不要
    }
  }
);

/**
 * Supabase接続のヘルスチェック
 * @returns {Promise<boolean>} 接続が正常ならtrue
 */
async function checkConnection() {
  try {
    const { error } = await supabase.from('tasks').select('id').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('❌ Supabase接続エラー:', error.message);
      return false;
    }
    console.log('✅ Supabase接続成功');
    return true;
  } catch (error) {
    console.error('❌ Supabase接続失敗:', error.message);
    return false;
  }
}

module.exports = {
  supabase,
  checkConnection
};
```

### Step 3: 環境変数の確認

`.env`ファイルに以下の値が設定されていることを確認:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 4: 接続テスト

`src/db/connection.js`をテストするスクリプトを作成:

```javascript
// test-db-connection.js
const { checkConnection } = require('./src/db/connection');

(async () => {
  const isConnected = await checkConnection();
  if (isConnected) {
    console.log('✅ データベース接続モジュールは正常に動作しています');
    process.exit(0);
  } else {
    console.error('❌ データベース接続に失敗しました');
    process.exit(1);
  }
})();
```

実行:
```bash
node test-db-connection.js
```

### Step 5: `app.js`に接続チェックを追加

アプリ起動時にデータベース接続を確認するように修正:

```javascript
// app.js の先頭に追加
const { checkConnection } = require('./src/db/connection');

// アプリ起動処理の中に追加
(async () => {
  // データベース接続確認
  const isDbConnected = await checkConnection();
  if (!isDbConnected) {
    console.error('❌ データベース接続に失敗しました。環境変数を確認してください。');
    process.exit(1);
  }

  await app.start();
  console.log('⚡️ サポ田さんが起動しました！');
})();
```

## 📤 成果物

- ✅ `src/db/connection.js`が作成されている
- ✅ Supabaseクライアントがエクスポートされている
- ✅ `checkConnection()`関数が実装されている
- ✅ 接続テストが成功している
- ✅ `app.js`で起動時に接続確認している

## 🔍 確認方法

```bash
# 接続テストを実行
node test-db-connection.js

# アプリを起動して接続確認
npm start
# → "✅ Supabase接続成功" と表示されればOK
```

## ⚠️ 注意点

1. **環境変数の必須チェック**
   ```javascript
   if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
     throw new Error('SUPABASE_URLとSUPABASE_ANON_KEYを.envに設定してください');
   }
   ```

2. **セッション永続化を無効化**
   - サーバーサイド（Node.js）ではセッション永続化は不要
   - `persistSession: false`で無効化

3. **接続プールは自動管理**
   - Supabase JSクライアントは内部的に接続を管理
   - 明示的なプール設定は不要

4. **エラーハンドリング**
   - 接続失敗時は適切にログ出力
   - アプリケーション起動を止める（`process.exit(1)`）

## 🚀 次のステップ

→ [タスク4: タスクサービス層の実装](./task-04-task-service.md)
