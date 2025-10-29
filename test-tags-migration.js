require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { supabase } = require('./src/db/connection');

async function runMigration() {
  console.log('🔧 タグテーブルのマイグレーション開始...\n');

  try {
    // SQLファイルを読み込み
    const sqlPath = path.join(__dirname, 'migrations', '003_create_tags_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // SQL文を分割して実行
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      console.log('実行中:', statement.substring(0, 50) + '...');

      const { error } = await supabase.rpc('exec_sql', {
        query: statement
      });

      if (error) {
        // RPCが使えない場合は直接実行を試す
        console.log('⚠️ RPC失敗、直接実行を試みます...');

        // Postgresのクライアントライブラリがあれば使用
        const { createClient } = require('@supabase/supabase-js');
        const adminClient = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
        );

        const { error: directError } = await adminClient.rpc('exec_sql', {
          query: statement
        });

        if (directError) {
          console.error('❌ エラー:', directError.message);
        } else {
          console.log('✅ 成功');
        }
      } else {
        console.log('✅ 成功');
      }
    }

    console.log('\n🎉 マイグレーション完了！');

    // タグ一覧を確認
    const { data: tags, error: selectError } = await supabase
      .from('tags')
      .select('*');

    if (selectError) {
      console.error('タグ一覧取得エラー:', selectError);
    } else {
      console.log('\n📋 登録されたタグ:');
      tags.forEach(tag => {
        console.log(`  - ${tag.name} (${tag.color})`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ マイグレーションエラー:', error);
    process.exit(1);
  }
}

runMigration();
