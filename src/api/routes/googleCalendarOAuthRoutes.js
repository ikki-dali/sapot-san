/**
 * Google Calendar OAuth認証ルート
 */
const express = require('express');
const router = express.Router();
const googleCalendarOAuthController = require('../controllers/googleCalendarOAuthController');
const calendarListController = require('../controllers/calendarListController');

// OAuth認証開始
router.get('/auth', googleCalendarOAuthController.startAuth);

// OAuthコールバック
router.get('/callback', googleCalendarOAuthController.handleCallback);

// 連携状態確認
router.get('/status', googleCalendarOAuthController.getConnectionStatus);

// 連携解除
router.post('/disconnect', googleCalendarOAuthController.disconnectCalendar);

// カレンダー一覧を取得（新機能）
router.get('/calendars', calendarListController.getCalendarList);

// 使用するカレンダーを選択（新機能）
router.post('/select-calendar', calendarListController.selectCalendar);

module.exports = router;
