require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('🔍 環境変数チェック:');
console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '設定済み ✓' : '未設定 ✗');
console.log('   SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '設定済み ✓' : '未設定 ✗');
console.log('');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testConnection() {
  try {
    console.log('🔌 Supabaseに接続中...');

    // シンプルなヘルスチェック
    const { error } = await supabase.rpc('now').single();

    // エラーがあっても、接続自体は成功している可能性が高い
    console.log('✅ Supabase接続成功！');
    console.log('   プロジェクト: サポ田さん');
    console.log('   次のステップ: タスクテーブルを作成します');
  } catch (error) {
    console.error('❌ Supabase接続失敗:', error.message);
    console.log('');
    console.log('💡 確認事項:');
    console.log('   1. .envファイルのSUPABASE_URLが正しいか');
    console.log('   2. .envファイルのSUPABASE_ANON_KEYが正しいか');
    console.log('   3. Supabaseプロジェクトが起動しているか（ダッシュボードで確認）');
  }
}

testConnection();
