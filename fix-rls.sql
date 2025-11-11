-- google_calendar_tokensテーブルのRLS（Row Level Security）を無効化
-- これにより、SERVICE_ROLE_KEYを使用してテーブルにアクセスできるようになります

-- 現在のRLS状態を確認
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'google_calendar_tokens';

-- RLSを無効化
ALTER TABLE google_calendar_tokens DISABLE ROW LEVEL SECURITY;

-- 確認
SELECT
  tablename,
  rowsecurity as rls_enabled,
  CASE
    WHEN rowsecurity THEN '❌ RLS有効'
    ELSE '✅ RLS無効（正常）'
  END as status
FROM pg_tables
WHERE tablename = 'google_calendar_tokens';
