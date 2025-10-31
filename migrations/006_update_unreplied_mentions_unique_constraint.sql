-- ========================================
-- Migration: unreplied_mentions のUNIQUE制約を修正
-- 同じユーザーが同じメッセージで複数回メンションされた場合でも、
-- 各行を別レコードとして保存できるようにする
-- ========================================

-- 既存のUNIQUE制約を削除
ALTER TABLE unreplied_mentions 
DROP CONSTRAINT IF EXISTS unreplied_mentions_channel_message_ts_mentioned_user_key;

-- 新しいUNIQUE制約を追加（message_textを含める）
ALTER TABLE unreplied_mentions 
ADD CONSTRAINT unreplied_mentions_unique_mention 
UNIQUE (channel, message_ts, mentioned_user, message_text);

-- コメント
COMMENT ON CONSTRAINT unreplied_mentions_unique_mention ON unreplied_mentions IS '同じメッセージ内の異なるタスク依頼を区別するため、message_textを含めたユニーク制約';
