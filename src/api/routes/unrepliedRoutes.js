const express = require('express');
const router = express.Router();
const unrepliedController = require('../controllers/unrepliedController');

/**
 * 未返信メンションAPIルート
 */

// 未返信メンション一覧を取得
// GET /api/unreplied?hours=2
router.get('/', unrepliedController.getUnrepliedMentions);

// 未返信統計を取得
// GET /api/unreplied/stats
router.get('/stats', unrepliedController.getUnrepliedStats);

// メンションを既読にする
// POST /api/unreplied/:id/mark-replied
router.post('/:id/mark-replied', unrepliedController.markAsReplied);

module.exports = router;
