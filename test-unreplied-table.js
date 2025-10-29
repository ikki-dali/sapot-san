require('dotenv').config();
const { supabase } = require('./src/db/connection');

async function checkUnrepliedTable() {
  try {
    console.log('🔧 未返信メッセージ追跡テーブルの確認...\n');

    // テーブルが存在するか確認
    console.log('🔍 テーブル確認中...');
    const { data, error: checkError } = await supabase
      .from('unreplied_mentions')
      .select('id')
      .limit(1);

    if (checkError) {
      if (checkError.code === '42P01' || checkError.message.includes('relation') || checkError.message.includes('does not exist')) {
        console.log('⚠️ テーブルがまだ作成されていません。\n');
        console.log('📋 次のステップ:');
        console.log('1. Supabaseダッシュボードを開く: https://supabase.com/dashboard');
        console.log('2. プロジェクト「サポ田さん」を選択');
        console.log('3. 左メニューから「SQL Editor」を選択');
        console.log('4. 以下のファイルの内容をコピー&ペースト:');
        console.log('   migrations/002_create_unreplied_mentions_table.sql');
        console.log('5. 「Run」ボタンをクリック\n');
      } else {
        console.error('❌ テーブル確認エラー:', checkError.message);
        console.error('詳細:', checkError);
      }
    } else {
      console.log('✅ テーブルが正常に作成されています！');
      console.log(`📊 現在のレコード数: ${data.length}件\n`);
    }

  } catch (error) {
    console.error('❌ エラー:', error);
    process.exit(1);
  }
}

checkUnrepliedTable();
