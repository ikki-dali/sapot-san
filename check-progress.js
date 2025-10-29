require('dotenv').config();
const fs = require('fs');
const { checkConnection } = require('./src/db/connection');

console.log('🔍 サポ田さん開発進捗チェック\n');
console.log('='.repeat(50));

// Phase 1: データベース統合
console.log('\n📦 Phase 1: データベース統合');
console.log('-'.repeat(50));

const phase1Tasks = [
  { name: 'タスク1: Supabaseプロジェクト作成', check: () => process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY },
  { name: 'タスク2: tasksテーブル作成', check: async () => {
    try {
      const { supabase } = require('./src/db/connection');
      const { error } = await supabase.from('tasks').select('id').limit(1);
      return !error || error.code === 'PGRST116';
    } catch {
      return false;
    }
  }},
  { name: 'タスク3: 接続モジュール実装', check: () => fs.existsSync('./src/db/connection.js') },
  { name: 'タスク4: タスクサービス実装', check: () => fs.existsSync('./src/services/taskService.js') },
  { name: 'タスク5: app.jsリファクタリング', check: () => {
    const content = fs.readFileSync('./app.js', 'utf8');
    return content.includes('taskService') && !content.includes('const tasks = new Map()');
  }},
];

// Phase 2-6
const otherPhases = [
  { phase: 'Phase 2: 期限管理', tasks: [
    { name: 'タスク6: 期限管理機能', check: () => fs.existsSync('./src/services/deadlineService.js') },
    { name: 'タスク7: リマインダー実装', check: () => fs.existsSync('./src/services/reminderService.js') },
  ]},
  { phase: 'Phase 3: AI統合', tasks: [
    { name: 'タスク9: OpenAI API準備', check: () => !!process.env.OPENAI_API_KEY },
    { name: 'タスク10: AIサービス実装', check: () => fs.existsSync('./src/services/aiService.js') },
  ]},
];

async function checkProgress() {
  // Phase 1チェック
  let phase1Complete = 0;

  for (const task of phase1Tasks) {
    const result = typeof task.check === 'function' && task.check.constructor.name === 'AsyncFunction'
      ? await task.check()
      : task.check();

    const status = result ? '✅' : '⬜';
    console.log(`${status} ${task.name}`);

    if (result) phase1Complete++;
  }

  console.log(`\n進捗: ${phase1Complete}/${phase1Tasks.length} 完了 (${Math.round(phase1Complete/phase1Tasks.length*100)}%)`);

  // 環境変数チェック
  console.log('\n⚙️  環境変数');
  console.log('-'.repeat(50));
  console.log('✅ SUPABASE_URL:', process.env.SUPABASE_URL ? '設定済み' : '❌ 未設定');
  console.log('✅ SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '設定済み' : '❌ 未設定');
  console.log('⬜ SLACK_BOT_TOKEN:', process.env.SLACK_BOT_TOKEN && !process.env.SLACK_BOT_TOKEN.includes('your-') ? '設定済み' : '未設定');
  console.log('⬜ SLACK_APP_TOKEN:', process.env.SLACK_APP_TOKEN && !process.env.SLACK_APP_TOKEN.includes('your-') ? '設定済み' : '未設定');
  console.log('⬜ OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '設定済み' : '未設定');

  // データベース接続チェック
  console.log('\n🗄️  データベース接続');
  console.log('-'.repeat(50));
  const dbConnected = await checkConnection();

  // ファイル構造チェック
  console.log('\n📁 ファイル構造');
  console.log('-'.repeat(50));
  const files = [
    { path: 'src/db/connection.js', label: 'データベース接続' },
    { path: 'src/services/taskService.js', label: 'タスクサービス' },
    { path: 'migrations/001_create_tasks_table.sql', label: 'マイグレーション' },
  ];

  files.forEach(({ path, label }) => {
    const exists = fs.existsSync(path);
    console.log(`${exists ? '✅' : '⬜'} ${label}: ${path}`);
  });

  // 依存パッケージチェック
  console.log('\n📦 依存パッケージ');
  console.log('-'.repeat(50));
  const packages = ['@slack/bolt', '@supabase/supabase-js', 'dotenv'];
  const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

  packages.forEach(pkg => {
    const installed = packageJson.dependencies[pkg];
    console.log(`${installed ? '✅' : '⬜'} ${pkg}: ${installed || '未インストール'}`);
  });

  // 次のステップ
  console.log('\n🚀 次のステップ');
  console.log('-'.repeat(50));

  if (phase1Complete < 3) {
    console.log(`📝 タスク${phase1Complete + 1}を実装してください`);
  } else if (phase1Complete === 3) {
    console.log('📝 タスク4: タスクサービス層の実装 ← 今ここ！');
  } else if (phase1Complete === 4) {
    console.log('📝 タスク5: app.jsのリファクタリング');
  } else if (phase1Complete === 5) {
    console.log('🎉 Phase 1完了！Phase 2（期限管理）に進めます');
  }

  console.log('\n' + '='.repeat(50));
  console.log('✨ チェック完了！\n');
}

checkProgress();
