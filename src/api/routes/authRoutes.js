const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * POST /api/auth/register
 * 新規ユーザー登録
 */
router.post('/register', authController.register);

/**
 * POST /api/auth/login
 * ログイン
 */
router.post('/login', authController.login);

/**
 * POST /api/auth/logout
 * ログアウト
 */
router.post('/logout', authController.logout);

/**
 * GET /api/auth/me
 * 現在のユーザー情報取得
 */
router.get('/me', authController.getCurrentUser);

module.exports = router;
