-- ユーザーテーブルに所属部署カラムを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(255);

-- 部署名にインデックスを追加（検索とグループ化を高速化）
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);

-- 既存ユーザーのdepartmentはNULLのままでOK（後で設定可能）
