// モックを設定
jest.mock('../../src/db/connection', () => ({
  supabase: {
    from: jest.fn()
  }
}));

jest.mock('../../src/services/taskService', () => ({
  getUpcomingTasks: jest.fn()
}));

jest.mock('../../src/services/unrepliedService', () => ({
  checkAndAutoTaskUnreplied: jest.fn()
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn()
}));

const { supabase } = require('../../src/db/connection');
const taskService = require('../../src/services/taskService');
const unrepliedService = require('../../src/services/unrepliedService');
const cron = require('node-cron');

const {
  checkUpcomingDeadlines,
  checkOverdueTasks,
  sendDeadlineReminder,
  sendOverdueReminder,
  startReminderJobs
} = require('../../src/services/reminderService');

describe('ReminderService', () => {
  let mockSlackClient;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSlackClient = {
      chat: {
        postMessage: jest.fn().mockResolvedValue({})
      }
    };
  });

  describe('checkUpcomingDeadlines', () => {
    test('should check and notify upcoming deadline tasks', async () => {
      const mockTasks = [
        {
          task_id: 'task_1',
          text: 'テストタスク1',
          channel: 'C123',
          assignee: 'U123',
          due_date: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12時間後
          message_ts: '1234.567'
        },
        {
          task_id: 'task_2',
          text: 'テストタスク2',
          channel: 'C456',
          assignee: 'U456',
          due_date: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(), // 20時間後
          message_ts: '1234.568'
        }
      ];

      taskService.getUpcomingTasks.mockResolvedValue(mockTasks);

      await checkUpcomingDeadlines(mockSlackClient, 24);

      expect(taskService.getUpcomingTasks).toHaveBeenCalledWith(24);
      expect(mockSlackClient.chat.postMessage).toHaveBeenCalledTimes(2);
    });

    test('should handle when no upcoming tasks exist', async () => {
      taskService.getUpcomingTasks.mockResolvedValue([]);

      await checkUpcomingDeadlines(mockSlackClient, 24);

      expect(taskService.getUpcomingTasks).toHaveBeenCalledWith(24);
      expect(mockSlackClient.chat.postMessage).not.toHaveBeenCalled();
    });

    test('should handle errors gracefully', async () => {
      taskService.getUpcomingTasks.mockRejectedValue(new Error('Database error'));

      await checkUpcomingDeadlines(mockSlackClient, 24);

      // エラーが起きてもクラッシュしないことを確認
      expect(taskService.getUpcomingTasks).toHaveBeenCalled();
    });
  });

  describe('checkOverdueTasks', () => {
    test('should check and notify overdue tasks', async () => {
      const mockOverdueTasks = [
        {
          task_id: 'task_1',
          text: '期限切れタスク',
          channel: 'C123',
          assignee: 'U123',
          due_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2日前
          message_ts: '1234.567'
        }
      ];

      const mockOrder = jest.fn().mockResolvedValue({ data: mockOverdueTasks, error: null });
      const mockLt = jest.fn().mockReturnValue({ order: mockOrder });
      const mockEq = jest.fn().mockReturnValue({ lt: mockLt });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      supabase.from.mockReturnValue({ select: mockSelect });

      await checkOverdueTasks(mockSlackClient);

      expect(supabase.from).toHaveBeenCalledWith('tasks');
      expect(mockSlackClient.chat.postMessage).toHaveBeenCalledTimes(1);
    });

    test('should handle when no overdue tasks exist', async () => {
      const mockOrder = jest.fn().mockResolvedValue({ data: [], error: null });
      const mockLt = jest.fn().mockReturnValue({ order: mockOrder });
      const mockEq = jest.fn().mockReturnValue({ lt: mockLt });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      supabase.from.mockReturnValue({ select: mockSelect });

      await checkOverdueTasks(mockSlackClient);

      expect(mockSlackClient.chat.postMessage).not.toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      const mockError = new Error('Database error');
      const mockOrder = jest.fn().mockResolvedValue({ data: null, error: mockError });
      const mockLt = jest.fn().mockReturnValue({ order: mockOrder });
      const mockEq = jest.fn().mockReturnValue({ lt: mockLt });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      supabase.from.mockReturnValue({ select: mockSelect });

      await checkOverdueTasks(mockSlackClient);

      expect(mockSlackClient.chat.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('sendDeadlineReminder', () => {
    test('should send deadline reminder message', async () => {
      const task = {
        task_id: 'task_123',
        text: 'テストタスク',
        channel: 'C123',
        assignee: 'U123',
        due_date: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12時間後
        message_ts: '1234.567'
      };

      await sendDeadlineReminder(mockSlackClient, task);

      expect(mockSlackClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          text: '⏰ *タスクの期限が近づいています*',
          blocks: expect.any(Array),
          thread_ts: '1234.567'
        })
      );
    });

    test('should not add thread_ts for manual tasks', async () => {
      const task = {
        task_id: 'task_123',
        text: 'テストタスク',
        channel: 'C123',
        assignee: 'U123',
        due_date: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        message_ts: 'manual_1234567890'
      };

      await sendDeadlineReminder(mockSlackClient, task);

      const callArgs = mockSlackClient.chat.postMessage.mock.calls[0][0];
      expect(callArgs.thread_ts).toBeUndefined();
    });

    test('should handle Slack API errors', async () => {
      const task = {
        task_id: 'task_123',
        text: 'テストタスク',
        channel: 'C123',
        assignee: 'U123',
        due_date: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        message_ts: '1234.567'
      };

      mockSlackClient.chat.postMessage.mockRejectedValue(new Error('Slack API error'));

      await sendDeadlineReminder(mockSlackClient, task);

      // エラーが起きてもクラッシュしないことを確認
      expect(mockSlackClient.chat.postMessage).toHaveBeenCalled();
    });
  });

  describe('sendOverdueReminder', () => {
    test('should send overdue reminder message', async () => {
      const task = {
        task_id: 'task_123',
        text: '期限切れタスク',
        channel: 'C123',
        assignee: 'U123',
        due_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2日前
        message_ts: '1234.567'
      };

      await sendOverdueReminder(mockSlackClient, task);

      expect(mockSlackClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          text: '🚨 *タスクの期限が過ぎています*',
          blocks: expect.any(Array),
          thread_ts: '1234.567'
        })
      );
    });

    test('should calculate days past due correctly', async () => {
      const task = {
        task_id: 'task_123',
        text: '期限切れタスク',
        channel: 'C123',
        assignee: 'U123',
        due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5日前
        message_ts: '1234.567'
      };

      await sendOverdueReminder(mockSlackClient, task);

      const callArgs = mockSlackClient.chat.postMessage.mock.calls[0][0];
      const blocksText = callArgs.blocks[0].text.text;

      // メッセージに「5日」が含まれていることを確認
      expect(blocksText).toContain('5日');
    });

    test('should handle Slack API errors', async () => {
      const task = {
        task_id: 'task_123',
        text: '期限切れタスク',
        channel: 'C123',
        assignee: 'U123',
        due_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        message_ts: '1234.567'
      };

      mockSlackClient.chat.postMessage.mockRejectedValue(new Error('Slack API error'));

      await sendOverdueReminder(mockSlackClient, task);

      expect(mockSlackClient.chat.postMessage).toHaveBeenCalled();
    });
  });

  describe('startReminderJobs', () => {
    test('should schedule all cron jobs', () => {
      startReminderJobs(mockSlackClient);

      // 4つのcronジョブがスケジュールされることを確認
      expect(cron.schedule).toHaveBeenCalledTimes(4);

      // 各スケジュールを確認
      expect(cron.schedule).toHaveBeenCalledWith(
        '0 9 * * *',
        expect.any(Function),
        expect.objectContaining({ timezone: 'Asia/Tokyo' })
      );

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 18 * * *',
        expect.any(Function),
        expect.objectContaining({ timezone: 'Asia/Tokyo' })
      );

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 * * * *',
        expect.any(Function),
        expect.objectContaining({ timezone: 'Asia/Tokyo' })
      );

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 10 * * *',
        expect.any(Function),
        expect.objectContaining({ timezone: 'Asia/Tokyo' })
      );
    });
  });
});
