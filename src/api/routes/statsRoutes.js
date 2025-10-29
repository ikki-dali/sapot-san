const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');

/**
 * 統計情報APIルート
 */

// ダッシュボード統計
// GET /api/stats/dashboard
router.get('/dashboard', statsController.getDashboardStats);

// タスク完了率の推移
// GET /api/stats/trend?days=7
router.get('/trend', statsController.getTaskTrend);

module.exports = router;
