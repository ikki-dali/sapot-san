// テスト用の環境変数を設定
require('dotenv').config({ path: '.env' });

// テスト環境であることを明示
process.env.NODE_ENV = 'test';

// ログレベルをエラーのみに設定（テスト出力をクリーンに）
process.env.LOG_LEVEL = 'error';

// モックされたSlack/Supabase/OpenAI APIを使用
process.env.USE_MOCKS = 'true';
