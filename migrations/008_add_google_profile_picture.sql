-- usersテーブルにGoogleプロフィール画像URLを追加
ALTER TABLE users
ADD COLUMN google_profile_picture TEXT;

-- コメントを追加
COMMENT ON COLUMN users.google_profile_picture IS 'GoogleアカウントのプロフィールURL';
