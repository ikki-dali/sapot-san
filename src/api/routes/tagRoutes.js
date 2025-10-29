const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tagController');

// タグ一覧取得
router.get('/', tagController.getAllTags);

// タグ作成
router.post('/', tagController.createTag);

// タグ削除
router.delete('/:id', tagController.deleteTag);

// タスクにタグを追加
router.post('/task/:taskId', tagController.addTagsToTask);

// タスクからタグを削除
router.delete('/task/:taskId/:tagId', tagController.removeTagFromTask);

// タスクのタグ一覧取得
router.get('/task/:taskId', tagController.getTaskTags);

module.exports = router;
