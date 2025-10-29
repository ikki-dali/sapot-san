require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./src/utils/logger');

// ルーターのインポート
const taskRoutes = require('./src/api/routes/taskRoutes');
const statsRoutes = require('./src/api/routes/statsRoutes');
const calendarRoutes = require('./src/api/routes/calendarRoutes');
const unrepliedRoutes = require('./src/api/routes/unrepliedRoutes');
const tagRoutes = require('./src/api/routes/tagRoutes');

const app = express();
const PORT = process.env.API_PORT || 3000;

// ミドルウェア
app.use(cors()); // CORS有効化
app.use(express.json()); // JSONボディパーサー
app.use(express.urlencoded({ extended: true })); // URLエンコードボディパーサー

// 静的ファイルの配信
app.use(express.static('public'));

// リクエストログ
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip
  });
  next();
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'サポ田さん APIサーバーは正常に動作しています',
    timestamp: new Date().toISOString()
  });
});

// APIルート
app.use('/api/tasks', taskRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/unreplied', unrepliedRoutes);
app.use('/api/tags', tagRoutes);

// API情報エンドポイント
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'サポ田さん API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      tasks: '/api/tasks',
      stats: '/api/stats',
      calendar: '/api/calendar',
      unreplied: '/api/unreplied',
      tags: '/api/tags'
    }
  });
});

// 404エラーハンドラー（APIリクエストのみ）
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({
      success: false,
      error: 'エンドポイントが見つかりません'
    });
  } else {
    next();
  }
});

// グローバルエラーハンドラー
app.use((err, req, res, next) => {
  logger.failure('APIエラー', {
    error: err.message,
    stack: err.stack,
    path: req.path
  });

  res.status(err.status || 500).json({
    success: false,
    error: err.message || '内部サーバーエラー'
  });
});

// Vercel環境以外でのみサーバー起動
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    logger.success(`APIサーバーが起動しました`, {
      port: PORT,
      url: `http://localhost:${PORT}`
    });
  });

  // グレースフルシャットダウン
  process.on('SIGTERM', () => {
    logger.info('SIGTERMシグナルを受信しました。APIサーバーを停止します。');
    server.close(() => {
      logger.info('APIサーバーが正常に停止しました');
      process.exit(0);
    });
  });
}

// Vercel用にエクスポート
module.exports = app;
