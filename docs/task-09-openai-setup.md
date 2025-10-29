# タスク9: OpenAI API統合の準備

**フェーズ**: Phase 3 - AI統合
**難易度**: Simple
**推定時間**: 30分
**依存関係**: なし（並行実行可能）

## 🎯 目標

OpenAI APIをプロジェクトに統合し、APIキーを設定して接続テストを完了する。

## 📋 背景

タスクの自動要約、優先度判定、担当者提案などのAI機能を実装するために、OpenAI APIを導入します。

## ✅ 実装手順

### チェックリスト
- [ ] OpenAI APIキーを取得
- [ ] `openai` SDKをインストール
- [ ] 環境変数を設定
- [ ] 接続テストを実施
- [ ] 月額コスト見積もりを確認

---

### Step 1: OpenAI APIキーの取得

1. **OpenAIアカウント作成**
   - https://platform.openai.com/ にアクセス
   - アカウント作成（既にある場合はログイン）

2. **APIキー発行**
   - https://platform.openai.com/api-keys にアクセス
   - 「Create new secret key」をクリック
   - キー名を入力（例: `sapot-san-dev`）
   - 生成されたキーをコピー（一度しか表示されないので注意！）

3. **使用量制限の設定（推奨）**
   - https://platform.openai.com/account/limits にアクセス
   - Monthly budget limitを設定（例: $20/月）
   - 想定外の課金を防ぐ

### Step 2: OpenAI SDKのインストール

```bash
npm install openai
```

### Step 3: 環境変数の設定

`.env`ファイルに追加:

```env
# OpenAI API
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
```

`.env.example`にも追加:

```env
# OpenAI API
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini
```

### Step 4: 接続テストスクリプトの作成

`test-openai-connection.js`を作成:

```javascript
require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testOpenAI() {
  try {
    console.log('🤖 OpenAI API接続テスト開始\n');

    // シンプルなテストプロンプト
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'あなたは簡潔に応答するアシスタントです。'
        },
        {
          role: 'user',
          content: 'こんにちは！接続テストです。短く挨拶してください。'
        }
      ],
      max_tokens: 100,
      temperature: 0.7
    });

    const reply = response.choices[0].message.content;
    const tokensUsed = response.usage.total_tokens;

    console.log('✅ OpenAI API接続成功！');
    console.log(`📝 応答: ${reply}`);
    console.log(`🎫 使用トークン数: ${tokensUsed}`);
    console.log(`💰 推定コスト: $${estimateCost(tokensUsed, process.env.OPENAI_MODEL)}`);

    console.log('\n✅ テスト完了！OpenAI APIは正常に動作しています。');
  } catch (error) {
    console.error('❌ OpenAI API接続失敗:', error.message);

    if (error.code === 'invalid_api_key') {
      console.error('💡 APIキーが無効です。.envファイルを確認してください。');
    } else if (error.code === 'insufficient_quota') {
      console.error('💡 APIクォータが不足しています。OpenAIの使用量を確認してください。');
    }

    process.exit(1);
  }
}

/**
 * トークン使用量からコストを概算
 * @param {number} tokens - 使用トークン数
 * @param {string} model - モデル名
 */
function estimateCost(tokens, model = 'gpt-4o-mini') {
  // 料金（2024年1月時点、最新は https://openai.com/pricing で確認）
  const pricing = {
    'gpt-4o': { input: 0.0025, output: 0.01 }, // $2.50/$10 per 1M tokens
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 }, // $0.15/$0.60 per 1M tokens
    'gpt-4-turbo': { input: 0.001, output: 0.003 }, // $1/$3 per 1M tokens
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 } // $0.50/$1.50 per 1M tokens
  };

  const rate = pricing[model] || pricing['gpt-4o-mini'];
  // 簡易計算（入力と出力を平均）
  const avgRate = (rate.input + rate.output) / 2;
  const cost = (tokens / 1000000) * avgRate;

  return cost.toFixed(6);
}

testOpenAI();
```

実行:
```bash
node test-openai-connection.js
```

### Step 5: モデルの選択とコスト見積もり

#### 推奨モデル

| モデル | 用途 | コスト（入力/出力） | 特徴 |
|--------|------|---------------------|------|
| **gpt-4o-mini** | 推奨（開発・本番） | $0.15/$0.60 per 1M | 最もコスパが良い |
| gpt-4o | 高精度が必要な場合 | $2.50/$10 per 1M | 最新で高性能 |
| gpt-3.5-turbo | 低コスト重視 | $0.50/$1.50 per 1M | 軽量で高速 |

#### 月額コスト見積もり

**前提条件**:
- タスク作成: 1日10件
- 1件あたりのトークン: 500トークン（スレッド要約含む）
- 月間: 30日

**計算**:
```
月間トークン数 = 10件/日 × 500トークン × 30日 = 150,000トークン
月額コスト (gpt-4o-mini) = (150,000 / 1,000,000) × 0.375 = $0.056
                          ≈ 約 8円/月（1ドル=140円換算）
```

**実用的な見積もり**:
- 小規模チーム（10〜20人）: **$1〜5/月**
- 中規模チーム（50人）: **$10〜20/月**

### Step 6: エラーハンドリングとリトライの実装（オプション）

接続エラーやレート制限に対応するためのユーティリティ:

```javascript
// src/utils/openaiHelper.js
async function callOpenAIWithRetry(apiCall, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.code === 'rate_limit_exceeded' && i < maxRetries - 1) {
        console.log(`⏳ レート制限エラー。${i + 1}秒後にリトライします...`);
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 1000));
      } else {
        throw error;
      }
    }
  }
}

module.exports = { callOpenAIWithRetry };
```

## 📤 成果物

- ✅ OpenAI APIキーが取得されている
- ✅ `openai` SDKがインストールされている
- ✅ `.env`にAPIキーが設定されている
- ✅ 接続テストが成功している
- ✅ 月額コスト見積もりが完了している

## 🔍 確認方法

```bash
# OpenAI SDKがインストールされているか確認
npm list openai

# 環境変数が設定されているか確認
cat .env | grep OPENAI

# 接続テスト実行
node test-openai-connection.js

# 出力例:
# ✅ OpenAI API接続成功！
# 📝 応答: こんにちは！接続テストですね。
# 🎫 使用トークン数: 45
# 💰 推定コスト: $0.000017
```

## ⚠️ 注意点

1. **APIキーの管理**
   - `.env`ファイルは絶対にGitにコミットしない
   - 本番環境では環境変数で管理
   - 定期的にキーをローテーション

2. **コスト管理**
   - OpenAIダッシュボードで使用量を定期的に確認
   - Monthly budget limitを必ず設定
   - 大量のリクエストを送る前にテスト

3. **モデルの選択**
   - 開発環境: `gpt-4o-mini` （最安）
   - 本番環境: `gpt-4o-mini` または `gpt-4o` （用途に応じて）
   - `gpt-4o`は高精度だが約17倍高い

4. **レート制限**
   - Tier 1（新規アカウント）: 3 RPM (requests per minute)
   - Tier 2（$5以上使用）: 500 RPM
   - リトライ処理を実装推奨

5. **トークン数の最適化**
   - プロンプトを簡潔にする
   - 不要なコンテキストは含めない
   - `max_tokens`で出力を制限

## 🚀 次のステップ

→ [タスク10: AIサービス層の実装](./task-10-ai-service.md)
