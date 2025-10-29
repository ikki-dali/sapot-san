require('dotenv').config();
const { supabase } = require('./src/db/connection');

async function checkUsersTable() {
  try {
    // usersテーブルが存在するか確認
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        console.log('❌ usersテーブルは存在しません');
        return false;
      }
      console.error('エラー:', error);
      return false;
    }

    console.log('✅ usersテーブルは存在します');
    console.log('データサンプル:', data);
    return true;
  } catch (error) {
    console.error('エラー:', error.message);
    return false;
  }
}

checkUsersTable();
