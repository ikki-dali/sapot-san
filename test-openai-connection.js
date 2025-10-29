require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testOpenAI() {
  try {
    console.log('🤖 OpenAI API接続テスト開始\n');
    console.log(`使用モデル: ${process.env.OPENAI_MODEL || 'gpt-4o-latest'}\n`);

    // シンプルなテストプロンプト
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-latest',
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
    } else if (error.status === 404) {
      console.error('💡 モデルが見つかりません。OPENAI_MODELを確認してください。');
      console.error('   有効なモデル: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo');
    }

    process.exit(1);
  }
}

/**
 * トークン使用量からコストを概算
 * @param {number} tokens - 使用トークン数
 * @param {string} model - モデル名
 */
function estimateCost(tokens, model = 'gpt-4o-latest') {
  // 料金（2024年時点、最新は https://openai.com/pricing で確認）
  const pricing = {
    'gpt-4o': { input: 0.0025, output: 0.01 }, // $2.50/$10 per 1M tokens
    'gpt-4o-latest': { input: 0.0025, output: 0.01 }, // 同じ
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 }, // $0.15/$0.60 per 1M tokens
    'gpt-4-turbo': { input: 0.001, output: 0.003 }, // $1/$3 per 1M tokens
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 } // $0.50/$1.50 per 1M tokens
  };

  const rate = pricing[model] || pricing['gpt-4o'];
  // 簡易計算（入力と出力を平均）
  const avgRate = (rate.input + rate.output) / 2;
  const cost = (tokens / 1000000) * avgRate;

  return cost.toFixed(6);
}

testOpenAI();
