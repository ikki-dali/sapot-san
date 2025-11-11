const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const { authenticateToken } = require('../../middleware/auth');

// すべてのルートで認証が必要
router.use(authenticateToken);

// プロフィール情報を更新
router.put('/profile', accountController.updateProfile);

// パスワードを変更
router.put('/password', accountController.updatePassword);

module.exports = router;
