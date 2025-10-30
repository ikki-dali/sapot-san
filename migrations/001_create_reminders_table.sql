-- カスタムリマインダーテーブル
-- ユーザーが「1分後にリマインドして」などで作成するリマインダーを管理

CREATE TABLE IF NOT EXISTS reminders (
  id BIGSERIAL PRIMARY KEY,
  reminder_type TEXT NOT NULL DEFAULT 'once' CHECK (reminder_type IN ('once', 'recurring')),
  target_user TEXT NOT NULL,
  created_by TEXT NOT NULL,
  message TEXT NOT NULL,
  channel TEXT NOT NULL,
  thread_ts TEXT,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('absolute', 'relative', 'interval')),
  schedule_time TIMESTAMPTZ,
  interval_minutes INTEGER,
  relative_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  next_reminder_at TIMESTAMPTZ,  -- NULLを許可（1回のみのリマインド実行後はNULL）
  last_reminded_at TIMESTAMPTZ,
  remind_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_reminders_target_user ON reminders(target_user);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
CREATE INDEX IF NOT EXISTS idx_reminders_next_reminder_at ON reminders(next_reminder_at);
CREATE INDEX IF NOT EXISTS idx_reminders_created_by ON reminders(created_by);

-- 更新日時の自動更新トリガー
CREATE OR REPLACE FUNCTION update_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reminders_updated_at ON reminders;
CREATE TRIGGER trigger_reminders_updated_at
  BEFORE UPDATE ON reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_reminders_updated_at();

-- コメント追加
COMMENT ON TABLE reminders IS 'ユーザーが作成するカスタムリマインダー';
COMMENT ON COLUMN reminders.reminder_type IS 'リマインドタイプ: once（1回のみ）, recurring（繰り返し）';
COMMENT ON COLUMN reminders.schedule_type IS 'スケジュールタイプ: absolute（絶対時刻）, relative（相対時間）, interval（間隔）';
COMMENT ON COLUMN reminders.next_reminder_at IS '次回リマインド実行日時';
COMMENT ON COLUMN reminders.last_reminded_at IS '最後にリマインドした日時';
COMMENT ON COLUMN reminders.remind_count IS 'リマインド実行回数';
