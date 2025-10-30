-- ========================================
-- Migration: 優先度カラムを unreplied_mentions テーブルに追加
-- ========================================

-- 優先度カラムを追加（1=高, 2=中, 3=低）
ALTER TABLE unreplied_mentions 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 2;

-- カラムコメント
COMMENT ON COLUMN unreplied_mentions.priority IS '優先度 (1=高, 2=中, 3=低)';

-- インデックス: 優先度での検索を高速化
CREATE INDEX IF NOT EXISTS idx_unreplied_priority ON unreplied_mentions(priority);
