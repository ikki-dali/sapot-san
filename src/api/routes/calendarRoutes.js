const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');

// カレンダー設定
router.get('/settings', calendarController.getCalendarSettings);
router.post('/settings', calendarController.saveCalendarSettings);
router.delete('/settings/:slackUserId', calendarController.deleteCalendarSettings);

module.exports = router;
