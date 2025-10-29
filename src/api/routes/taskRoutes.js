const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');

/**
 * タスク管理APIルート
 */

// タスク一覧取得
// GET /api/tasks?status=open&assignee=U123&channel=C456
router.get('/', taskController.getTasks);

// チャンネル一覧取得
// GET /api/tasks/channels
router.get('/channels', taskController.getChannels);

// 期限が近いタスク取得
// GET /api/tasks/upcoming?hours=24
router.get('/upcoming', taskController.getUpcomingTasks);

// 単一タスク取得
// GET /api/tasks/:taskId
router.get('/:taskId', taskController.getTaskById);

// タスク作成
// POST /api/tasks
router.post('/', taskController.createTask);

// タスク更新
// PUT /api/tasks/:taskId
router.put('/:taskId', taskController.updateTask);

// タスク完了
// POST /api/tasks/:taskId/complete
router.post('/:taskId/complete', taskController.completeTask);

// タスク削除
// DELETE /api/tasks/:taskId
router.delete('/:taskId', taskController.deleteTask);

module.exports = router;
