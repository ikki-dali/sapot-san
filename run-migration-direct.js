/**
 * Migration 005を直接データベースに適用
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Supabase URLからPostgreSQL接続文字列を構築
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ SUPABASE_URLが設定されていません');
  process.exit(1);
}

// Supabase URLからプロジェクトIDを抽出
const projectId = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

console.log('📋 Migration 005を適用します');
console.log(`🔗 Supabase Project: ${projectId}`);
console.log('');

const migrationSQL = fs.readFileSync(
  path.join(__dirname, 'migrations', '005_add_priority_to_unreplied_mentions.sql'),
  'utf-8'
);

console.log('実行するSQL:');
console.log('=====================================');
console.log(migrationSQL);
console.log('=====================================');
console.log('');
console.log('⚠️  このSQLを以下のいずれかの方法で実行してください:');
console.log('');
console.log('【方法1】Supabase SQL Editorで実行');
console.log(`   https://supabase.com/dashboard/project/${projectId}/sql/new`);
console.log('');
console.log('【方法2】Supabaseのpsqlで実行');
console.log(`   psql "postgresql://postgres.[PASSWORD]@db.${projectId}.supabase.co:5432/postgres" -f migrations/005_add_priority_to_unreplied_mentions.sql`);
console.log('');
console.log('✅ 実行後、アプリを再起動すれば優先度機能が使えるようになります！');
