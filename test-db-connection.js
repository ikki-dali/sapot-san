const { checkConnection } = require('./src/db/connection');

(async () => {
  console.log('🧪 データベース接続モジュールのテスト\n');

  const isConnected = await checkConnection();

  if (isConnected) {
    console.log('\n✅ データベース接続モジュールは正常に動作しています');
    console.log('   サポ田さんプロジェクトに接続完了！');
    process.exit(0);
  } else {
    console.error('\n❌ データベース接続に失敗しました');
    process.exit(1);
  }
})();
