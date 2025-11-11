require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// 環境変数の検証
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ 環境変数エラー: SUPABASE_URL が未設定です');
  throw new Error('SUPABASE_URL環境変数が設定されていません。');
}

if (!supabaseAnonKey && !supabaseServiceKey) {
  console.error('❌ 環境変数エラー: SUPABASE_ANON_KEY または SUPABASE_SERVICE_ROLE_KEY が必要です');
  throw new Error('Supabase認証キーが設定されていません。');
}

// サーバーサイドなのでSERVICE_ROLE_KEYを優先的に使用（RLSをバイパス）
// SERVICE_ROLE_KEYがない場合はANON_KEYにフォールバック
const supabaseKey = supabaseServiceKey || supabaseAnonKey;

if (supabaseServiceKey) {
  console.log('ℹ️  Supabase接続: SERVICE_ROLE_KEY使用（RLSバイパス）');
} else {
  console.log('⚠️  Supabase接続: ANON_KEY使用（RLS有効）');
}

// Supabaseクライアントの作成
const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: false, // サーバーサイドなのでセッション永続化不要
      autoRefreshToken: false // サーバーサイドでは自動リフレッシュ不要
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
