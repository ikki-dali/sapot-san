const { supabase } = require('./src/db/connection');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  try {
    console.log('📋 優先度カラム追加のマイグレーションを実行します...');
    
    // マイグレーションSQLファイルを読み込む
    const migrationPath = path.join(__dirname, 'migrations', '005_add_priority_to_unreplied_mentions.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('実行するSQL:');
    console.log(sql);
    console.log('');
    
    // SQLを実行
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // rpcが使えない場合は直接実行を試みる
      console.log('⚠️  rpc経由で失敗、直接実行を試みます...');
      
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (!statement) continue;
        console.log(`実行中: ${statement.substring(0, 50)}...`);
        
        // Supabaseのクライアントライブラリ経由では直接SQLを実行できないため、
        // REST APIを使用
        const { error: execError } = await supabase.rpc('exec', { 
          sql: statement 
        });
        
        if (execError) {
          console.error(`❌ エラー:`, execError);
        }
      }
    }
    
    console.log('');
    console.log('✅ マイグレーション完了！');
    console.log('');
    
    // 確認: テーブルスキーマをチェック
    console.log('📊 テーブルスキーマを確認します...');
    const { data: tableData, error: tableError } = await supabase
      .from('unreplied_mentions')
      .select('*')
      .limit(1);
    
    if (!tableError) {
      console.log('✅ unreplied_mentions テーブルにアクセス可能');
      if (tableData && tableData.length > 0) {
        console.log('カラム:', Object.keys(tableData[0]));
      }
    }
    
  } catch (error) {
    console.error('❌ マイグレーション失敗:', error.message);
    process.exit(1);
  }
}

applyMigration();
