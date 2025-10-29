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
