/**
 * Google Calendar OAuthトークンテーブルを作成するスクリプト
 */
require('dotenv').config();
const { supabase } = require('../src/db/connection');

async function createCalendarTokensTable() {
  console.log('📝 Google Calendar トークンテーブルを作成します...');

  try {
    // テーブル作成SQL
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Google Calendar OAuthトークンを保存するテーブル
        CREATE TABLE IF NOT EXISTS google_calendar_tokens (
          id SERIAL PRIMARY KEY,
          slack_user_id VARCHAR(255) UNIQUE NOT NULL,
          access_token TEXT NOT NULL,
          refresh_token TEXT NOT NULL,
          token_expiry TIMESTAMPTZ NOT NULL,
          calendar_id VARCHAR(255) DEFAULT 'primary',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });

    if (tableError) {
      // rpcが存在しない場合は直接SQLを実行
      console.log('⚠️ rpc method not found, trying direct SQL execution...');

      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS google_calendar_tokens (
          id SERIAL PRIMARY KEY,
          slack_user_id VARCHAR(255) UNIQUE NOT NULL,
          access_token TEXT NOT NULL,
          refresh_token TEXT NOT NULL,
          token_expiry TIMESTAMPTZ NOT NULL,
          calendar_id VARCHAR(255) DEFAULT 'primary',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      // Note: Supabase JS クライアントでは DDL を直接実行できないため、
      // Supabase ダッシュボードの SQL Editor で以下を実行してください
      console.log('\n以下のSQLをSupabaseダッシュボードのSQL Editorで実行してください:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(createTableSQL);

      console.log(`
-- 更新日時を自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_google_calendar_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーを作成
DROP TRIGGER IF EXISTS google_calendar_tokens_updated_at_trigger ON google_calendar_tokens;
CREATE TRIGGER google_calendar_tokens_updated_at_trigger
BEFORE UPDATE ON google_calendar_tokens
FOR EACH ROW
EXECUTE FUNCTION update_google_calendar_tokens_updated_at();

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_slack_user_id
ON google_calendar_tokens(slack_user_id);
      `);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      console.log('📋 Supabaseダッシュボード: https://supabase.com/dashboard/project/xtdwqtxfnxdxahgrfeio/editor');
      return;
    }

    console.log('✅ テーブル作成成功！');

    // テーブルが存在するか確認
    const { data, error: selectError } = await supabase
      .from('google_calendar_tokens')
      .select('*')
      .limit(0);

    if (selectError) {
      console.error('❌ テーブル確認エラー:', selectError.message);
    } else {
      console.log('✅ テーブルが正常に作成されました');
    }

  } catch (error) {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }
}

// スクリプト実行
createCalendarTokensTable()
  .then(() => {
    console.log('✅ 完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 予期しないエラー:', error);
    process.exit(1);
  });
