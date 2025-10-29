module.exports = {
  // テスト環境をNode.jsに設定
  testEnvironment: 'node',

  // テストファイルのパターン
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],

  // カバレッジ収集の対象
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/__tests__/**'
  ],

  // カバレッジレポート形式
  coverageReporters: ['text', 'lcov', 'html'],

  // セットアップファイル（環境変数の読み込み）
  setupFiles: ['<rootDir>/jest.setup.js'],

  // タイムアウト設定（Slack APIのテストで必要）
  testTimeout: 10000,

  // モジュール解決
  moduleDirectories: ['node_modules', 'src'],

  // 詳細な出力
  verbose: true
};
