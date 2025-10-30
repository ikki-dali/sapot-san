-- remindersテーブルを修正：next_reminder_atをNULLABLEに変更
-- 既にテーブルが作成されている場合は、こちらを実行してください

-- NOT NULL制約を削除
ALTER TABLE reminders ALTER COLUMN next_reminder_at DROP NOT NULL;

-- デフォルト値を設定
ALTER TABLE reminders ALTER COLUMN reminder_type SET DEFAULT 'once';

-- コメント更新
COMMENT ON COLUMN reminders.next_reminder_at IS '次回リマインド実行日時（1回のみの場合は実行後NULL）';
