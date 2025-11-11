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
const authRoutes = require('./src/api/routes/authRoutes');
const googleCalendarOAuthRoutes = require('./src/api/routes/googleCalendarOAuthRoutes');
const userRoutes = require('./src/api/routes/userRoutes');
const accountRoutes = require('./src/api/routes/accountRoutes');

const app = express();
const PORT = process.env.PORT || process.env.API_PORT || 3000;

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

// ルートパスからログインページへリダイレクト
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'サポ田さん APIサーバーは正常に動作しています',
    timestamp: new Date().toISOString()
  });
});

// デバッグエンドポイント（環境変数チェック）
app.get('/api/debug/env', (req, res) => {
  res.json({
    success: true,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
      supabaseUrlPrefix: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 20) + '...' : 'NOT SET'
    },
    timestamp: new Date().toISOString()
  });
});

// APIルート
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/unreplied', unrepliedRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/google-calendar', googleCalendarOAuthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/account', accountRoutes);

// API情報エンドポイント
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'サポ田さん API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      tasks: '/api/tasks',
      stats: '/api/stats',
      calendar: '/api/calendar',
      unreplied: '/api/unreplied',
      tags: '/api/tags',
      googleCalendarOAuth: '/api/google-calendar',
      users: '/api/users'
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
