require('dotenv').config();
const { supabase } = require('./src/db/connection');

async function checkCalendarConnection() {
  try {
    console.log('📊 Google Calendar連携状態を確認中...\n');

    // すべての連携情報を取得
    const { data, error } = await supabase
      .from('google_calendar_tokens')
      .select('slack_user_id, calendar_id, token_expiry, created_at, updated_at');

    if (error) {
      console.error('❌ エラー:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('⚠️  カレンダー連携データが見つかりません');
      return;
    }

    console.log(`✅ ${data.length}件の連携データが見つかりました:\n`);
    data.forEach((token, index) => {
      console.log(`[${index + 1}]`);
      console.log(`  Slack User ID: ${token.slack_user_id}`);
      console.log(`  Calendar ID: ${token.calendar_id}`);
      console.log(`  Token Expiry: ${token.token_expiry}`);
      console.log(`  Created: ${token.created_at}`);
      console.log(`  Updated: ${token.updated_at}`);
      console.log('');
    });

    // ユーザー情報も確認
    console.log('\n📝 ユーザー情報を確認中...\n');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('slack_user_id, name, email, google_profile_picture')
      .in('slack_user_id', data.map(t => t.slack_user_id));

    if (userError) {
      console.error('❌ ユーザー情報取得エラー:', userError);
      return;
    }

    users.forEach((user, index) => {
      console.log(`[${index + 1}]`);
      console.log(`  Slack User ID: ${user.slack_user_id}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Profile Picture: ${user.google_profile_picture || '未設定'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    process.exit(0);
  }
}

checkCalendarConnection();
