-- =====================================================
-- Reminders Table: リマインド機能用テーブル
-- =====================================================

-- remindersテーブル作成
CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,

  -- リマインド基本情報
  reminder_type VARCHAR(20) NOT NULL,  -- 'once' (1回のみ) or 'recurring' (定期)
  target_user VARCHAR(50) NOT NULL,    -- 対象ユーザーのSlack ID
  created_by VARCHAR(50) NOT NULL,     -- 作成者のSlack ID
  message TEXT NOT NULL,               -- リマインドメッセージ

  -- Slack情報
  channel VARCHAR(50) NOT NULL,        -- チャンネルID
  thread_ts VARCHAR(50),               -- スレッドタイムスタンプ（スレッド内の場合）

  -- タイミング情報
  schedule_type VARCHAR(20) NOT NULL,  -- 'absolute' (絶対時刻), 'relative' (相対時間), 'interval' (繰り返し間隔)
  schedule_time TIMESTAMP,             -- 絶対時刻でのリマインド時刻
  interval_minutes INT,                -- 繰り返し間隔（分）
  relative_minutes INT,                -- 相対時間（〇分後）

  -- 状態管理
  status VARCHAR(20) DEFAULT 'active', -- 'active' (有効), 'completed' (完了), 'cancelled' (キャンセル)
  last_reminded_at TIMESTAMP,          -- 最後にリマインドした時刻
  next_reminder_at TIMESTAMP,          -- 次回のリマインド予定時刻

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- メタデータ（追加情報をJSON形式で保存）
  metadata JSONB
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_reminders_target_user ON reminders(target_user);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
CREATE INDEX IF NOT EXISTS idx_reminders_next_reminder_at ON reminders(next_reminder_at);
CREATE INDEX IF NOT EXISTS idx_reminders_created_by ON reminders(created_by);
CREATE INDEX IF NOT EXISTS idx_reminders_channel ON reminders(channel);

-- 次回リマインド予定時刻で検索するための複合インデックス
CREATE INDEX IF NOT EXISTS idx_reminders_active_next
  ON reminders(status, next_reminder_at)
  WHERE status = 'active';

-- updated_at 自動更新用のトリガー関数
CREATE OR REPLACE FUNCTION update_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー作成
CREATE TRIGGER trigger_reminders_updated_at
  BEFORE UPDATE ON reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_reminders_updated_at();

-- コメント追加
COMMENT ON TABLE reminders IS 'リマインド設定を管理するテーブル';
COMMENT ON COLUMN reminders.reminder_type IS 'once: 1回のみ, recurring: 定期リマインド';
COMMENT ON COLUMN reminders.schedule_type IS 'absolute: 絶対時刻, relative: 相対時間, interval: 繰り返し間隔';
COMMENT ON COLUMN reminders.status IS 'active: 有効, completed: 完了, cancelled: キャンセル';
COMMENT ON COLUMN reminders.next_reminder_at IS 'システムがチェックする次回のリマインド予定時刻';
