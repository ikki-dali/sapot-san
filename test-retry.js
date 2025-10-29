require('dotenv').config();
const { retryOperation } = require('./src/utils/errorHandler');
const logger = require('./src/utils/logger');

console.log('🧪 リトライ機構のテスト開始\n');

// テスト1: 3回目で成功するケース
async function test1() {
  console.log('テスト1: 3回目で成功するケース');
  console.log('─────────────────────────────────');

  let attempts = 0;

  try {
    await retryOperation(async () => {
      attempts++;
      logger.info(`試行回数: ${attempts}`);

      if (attempts < 3) {
        throw new Error('失敗（リトライします）');
      }

      logger.success('成功！');
      return '成功データ';
    }, 3, 500);

    console.log('✅ テスト1完了\n');
  } catch (error) {
    logger.failure('最大リトライ回数に達しました', { error: error.message });
    console.log('❌ テスト1失敗\n');
  }
}

// テスト2: すべて失敗するケース
async function test2() {
  console.log('テスト2: すべて失敗するケース');
  console.log('─────────────────────────────────');

  let attempts = 0;

  try {
    await retryOperation(async () => {
      attempts++;
      logger.info(`試行回数: ${attempts}`);
      throw new Error('常に失敗');
    }, 3, 300);

    console.log('✅ テスト2完了\n');
  } catch (error) {
    logger.failure('最大リトライ回数に達しました', { error: error.message });
    console.log('✅ テスト2完了（期待通り失敗）\n');
  }
}

// テスト3: 即座に成功するケース
async function test3() {
  console.log('テスト3: 即座に成功するケース');
  console.log('─────────────────────────────────');

  try {
    const result = await retryOperation(async () => {
      logger.success('1回目で成功！');
      return 'データ';
    }, 3, 300);

    console.log(`結果: ${result}`);
    console.log('✅ テスト3完了\n');
  } catch (error) {
    logger.failure('失敗', { error: error.message });
    console.log('❌ テスト3失敗\n');
  }
}

// すべてのテストを実行
(async () => {
  await test1();
  await test2();
  await test3();

  console.log('═════════════════════════════════');
  console.log('✅ すべてのテストが完了しました！');
  console.log('═════════════════════════════════');
})();
