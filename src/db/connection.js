require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// 環境変数の検証
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 環境変数エラー:');
  console.error('  SUPABASE_URL:', supabaseUrl ? '設定済み' : '未設定');
  console.error('  SUPABASE_ANON_KEY:', supabaseKey ? '設定済み' : '未設定');
  throw new Error('Supabase環境変数が設定されていません。Vercelの環境変数設定を確認してください。');
}

// Supabaseクライアントの作成
const supabase = createClient(
  supabaseUrl,
  supabaseKey,
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
