-- user_calendarsテーブル作成
-- ユーザーのSlack IDとGoogle CalendarIDを紐付ける

CREATE TABLE IF NOT EXISTS user_calendars (
  id SERIAL PRIMARY KEY,
  slack_user_id VARCHAR(255) UNIQUE NOT NULL,
  calendar_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- インデックスを作成（検索高速化）
CREATE INDEX IF NOT EXISTS idx_slack_user_id ON user_calendars(slack_user_id);

-- サンプルデータ挿入（山本さんのアカウント）
INSERT INTO user_calendars (slack_user_id, calendar_id, display_name)
VALUES ('U07M3H4RYK1', 'yamamotoikki@forestdali.biz', '山本 一気')
ON CONFLICT (slack_user_id) DO UPDATE
SET calendar_id = EXCLUDED.calendar_id,
    display_name = EXCLUDED.display_name,
    updated_at = CURRENT_TIMESTAMP;
