-- 未返信メッセージ追跡テーブル
-- 作成日: 2025-10-28
-- 説明: メンションされたが未返信のメッセージを追跡し、自動タスク化を管理

CREATE TABLE IF NOT EXISTS unreplied_mentions (
  id BIGSERIAL PRIMARY KEY,
  channel VARCHAR(255) NOT NULL,
  message_ts VARCHAR(255) NOT NULL,
  mentioned_user VARCHAR(255) NOT NULL,
  mentioner_user VARCHAR(255) NOT NULL,
  message_text TEXT NOT NULL,
  mentioned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  replied_at TIMESTAMP WITH TIME ZONE,
  auto_tasked BOOLEAN DEFAULT FALSE,
  task_id VARCHAR(255),
  UNIQUE(channel, message_ts, mentioned_user)
);

-- インデックス: チャンネルでの検索を高速化
CREATE INDEX IF NOT EXISTS idx_unreplied_channel ON unreplied_mentions(channel);

-- インデックス: ユーザーでの検索を高速化
CREATE INDEX IF NOT EXISTS idx_unreplied_user ON unreplied_mentions(mentioned_user);

-- インデックス: 未返信メッセージの検索を高速化
CREATE INDEX IF NOT EXISTS idx_unreplied_status ON unreplied_mentions(replied_at) WHERE replied_at IS NULL;

-- インデックス: 自動タスク化されていないメッセージの検索を高速化
CREATE INDEX IF NOT EXISTS idx_unreplied_auto_tasked ON unreplied_mentions(auto_tasked) WHERE auto_tasked = FALSE;

-- テーブルコメント
COMMENT ON TABLE unreplied_mentions IS 'メンションされたが未返信のメッセージを追跡し、自動タスク化を管理';

-- カラムコメント
COMMENT ON COLUMN unreplied_mentions.channel IS 'Slackチャンネル ID';
COMMENT ON COLUMN unreplied_mentions.message_ts IS 'メッセージタイムスタンプ（Slack ID）';
COMMENT ON COLUMN unreplied_mentions.mentioned_user IS 'メンションされたユーザーID';
COMMENT ON COLUMN unreplied_mentions.mentioner_user IS 'メンションしたユーザーID';
COMMENT ON COLUMN unreplied_mentions.message_text IS 'メッセージ本文';
COMMENT ON COLUMN unreplied_mentions.mentioned_at IS 'メンションされた日時';
COMMENT ON COLUMN unreplied_mentions.replied_at IS '返信された日時（NULL=未返信）';
COMMENT ON COLUMN unreplied_mentions.auto_tasked IS '自動タスク化されたかどうか';
COMMENT ON COLUMN unreplied_mentions.task_id IS '自動作成されたタスクID';
