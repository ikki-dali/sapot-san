/**
 * カレンダー一覧・選択ルーティング
 */
const express = require('express');
const router = express.Router();
const calendarListController = require('../controllers/calendarListController');

// カレンダー一覧を取得
router.get('/calendars', calendarListController.getCalendarList);

// 使用するカレンダーを選択
router.post('/select-calendar', calendarListController.selectCalendar);

module.exports = router;
