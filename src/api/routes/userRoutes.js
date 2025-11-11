const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// ユーザー一覧取得
router.get('/', userController.getAllUsers);

// 部署一覧取得
router.get('/departments', userController.getDepartments);

// ユーザー情報更新
router.put('/:userId', userController.updateUser);

module.exports = router;
