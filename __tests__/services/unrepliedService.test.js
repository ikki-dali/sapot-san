// モックを設定
jest.mock('../../src/db/connection', () => ({
  supabase: {
    from: jest.fn()
  }
}));

jest.mock('../../src/services/taskService', () => ({
  createTask: jest.fn()
}));

const { supabase } = require('../../src/db/connection');
const taskService = require('../../src/services/taskService');
const {
  recordMention,
  markAsReplied,
  getUnrepliedMentions,
  autoCreateTask,
  checkAndAutoTaskUnreplied,
  getUnrepliedStats
} = require('../../src/services/unrepliedService');

describe('UnrepliedService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordMention', () => {
    test('should record a new mention successfully', async () => {
      const mockMention = {
        channel: 'C123',
        message_ts: '1234.567',
        mentioned_user: 'U123',
        mentioner_user: 'U456',
        message_text: 'テストメンション'
      };

      const mockData = { id: 1, ...mockMention };

      const mockSingle = jest.fn().mockResolvedValue({ data: mockData, error: null });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

      supabase.from.mockReturnValue({ insert: mockInsert });

      const result = await recordMention({
        channel: 'C123',
        messageTs: '1234.567',
        mentionedUser: 'U123',
        mentionerUser: 'U456',
        text: 'テストメンション'
      });

      expect(supabase.from).toHaveBeenCalledWith('unreplied_mentions');
      expect(result).toEqual(mockData);
    });

    test('should return null for duplicate mentions', async () => {
      const mockError = { code: '23505' }; // unique_violation

      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: mockError });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

      supabase.from.mockReturnValue({ insert: mockInsert });

      const result = await recordMention({
        channel: 'C123',
        messageTs: '1234.567',
        mentionedUser: 'U123',
        mentionerUser: 'U456',
        text: 'テストメンション'
      });

      expect(result).toBeNull();
    });

    test('should return null on other database errors', async () => {
      const mockError = new Error('Database error');

      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: mockError });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

      supabase.from.mockReturnValue({ insert: mockInsert });

      const result = await recordMention({
        channel: 'C123',
        messageTs: '1234.567',
        mentionedUser: 'U123',
        mentionerUser: 'U456',
        text: 'テストメンション'
      });

      expect(result).toBeNull();
    });
  });

  describe('markAsReplied', () => {
    test('should mark a mention as replied', async () => {
      const mockData = [{ id: 1, replied_at: new Date().toISOString() }];

      const mockSelect = jest.fn().mockResolvedValue({ data: mockData, error: null });
      const mockIs = jest.fn().mockReturnValue({ select: mockSelect });
      const mockEq3 = jest.fn().mockReturnValue({ is: mockIs });
      const mockEq2 = jest.fn().mockReturnValue({ eq: mockEq3 });
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq1 });

      supabase.from.mockReturnValue({ update: mockUpdate });

      const result = await markAsReplied('C123', '1234.567', 'U123');

      expect(supabase.from).toHaveBeenCalledWith('unreplied_mentions');
      expect(mockUpdate).toHaveBeenCalledWith({
        replied_at: expect.any(String)
      });
      expect(result).toEqual(mockData);
    });

    test('should return null on database error', async () => {
      const mockError = new Error('Database error');

      const mockSelect = jest.fn().mockResolvedValue({ data: null, error: mockError });
      const mockIs = jest.fn().mockReturnValue({ select: mockSelect });
      const mockEq3 = jest.fn().mockReturnValue({ is: mockIs });
      const mockEq2 = jest.fn().mockReturnValue({ eq: mockEq3 });
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq1 });

      supabase.from.mockReturnValue({ update: mockUpdate });

      const result = await markAsReplied('C123', '1234.567', 'U123');

      expect(result).toBeNull();
    });
  });

  describe('getUnrepliedMentions', () => {
    test('should get unreplied mentions older than threshold', async () => {
      const mockMentions = [
        { id: 1, channel: 'C123', message_ts: '1234.567', mentioned_user: 'U123' },
        { id: 2, channel: 'C456', message_ts: '1234.568', mentioned_user: 'U456' }
      ];

      const mockOrder = jest.fn().mockResolvedValue({ data: mockMentions, error: null });
      const mockLt = jest.fn().mockReturnValue({ order: mockOrder });
      const mockEq = jest.fn().mockReturnValue({ lt: mockLt });
      const mockIs = jest.fn().mockReturnValue({ eq: mockEq });
      const mockSelect = jest.fn().mockReturnValue({ is: mockIs });

      supabase.from.mockReturnValue({ select: mockSelect });

      const result = await getUnrepliedMentions(24);

      expect(supabase.from).toHaveBeenCalledWith('unreplied_mentions');
      expect(result).toEqual(mockMentions);
      expect(result).toHaveLength(2);
    });

    test('should return empty array on database error', async () => {
      const mockError = new Error('Database error');

      const mockOrder = jest.fn().mockResolvedValue({ data: null, error: mockError });
      const mockLt = jest.fn().mockReturnValue({ order: mockOrder });
      const mockEq = jest.fn().mockReturnValue({ lt: mockLt });
      const mockIs = jest.fn().mockReturnValue({ eq: mockEq });
      const mockSelect = jest.fn().mockReturnValue({ is: mockIs });

      supabase.from.mockReturnValue({ select: mockSelect });

      const result = await getUnrepliedMentions(24);

      expect(result).toEqual([]);
    });
  });

  describe('autoCreateTask', () => {
    test('should automatically create a task from mention', async () => {
      const mockMention = {
        id: 1,
        channel: 'C123',
        message_ts: '1234.567',
        mentioned_user: 'U123',
        message_text: 'テストメンション'
      };

      const mockTask = {
        task_id: 'task_123',
        text: '【未返信】テストメンション',
        assignee: 'U123'
      };

      taskService.createTask.mockResolvedValue(mockTask);

      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });

      supabase.from.mockReturnValue({ update: mockUpdate });

      const result = await autoCreateTask(mockMention);

      expect(taskService.createTask).toHaveBeenCalledWith({
        text: '【未返信】テストメンション',
        channel: 'C123',
        messageTs: '1234.567',
        createdBy: 'auto_system',
        assignee: 'U123',
        priority: 2
      });

      expect(result).toEqual(mockTask);
    });

    test('should throw error when task creation fails', async () => {
      const mockMention = {
        id: 1,
        channel: 'C123',
        message_ts: '1234.567',
        mentioned_user: 'U123',
        message_text: 'テストメンション'
      };

      taskService.createTask.mockRejectedValue(new Error('Task creation failed'));

      await expect(autoCreateTask(mockMention)).rejects.toThrow('Task creation failed');
    });
  });

  describe('checkAndAutoTaskUnreplied', () => {
    test('should check and auto-task unreplied mentions', async () => {
      const mockMentions = [
        {
          id: 1,
          channel: 'C123',
          message_ts: '1234.567',
          mentioned_user: 'U123',
          message_text: 'テスト',
          mentioned_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() // 48時間前
        }
      ];

      const mockTask = { task_id: 'task_123' };

      // getUnrepliedMentionsのモック
      const mockOrder = jest.fn().mockResolvedValue({ data: mockMentions, error: null });
      const mockLt = jest.fn().mockReturnValue({ order: mockOrder });
      const mockEq = jest.fn().mockReturnValue({ lt: mockLt });
      const mockIs = jest.fn().mockReturnValue({ eq: mockEq });
      const mockSelect = jest.fn().mockReturnValue({ is: mockIs });

      supabase.from.mockReturnValue({ select: mockSelect });

      // autoCreateTaskのモック
      taskService.createTask.mockResolvedValue(mockTask);

      const mockEq2 = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq2 });

      supabase.from.mockReturnValue({
        select: mockSelect,
        update: mockUpdate
      });

      // Slackクライアントのモック
      const mockSlackClient = {
        chat: {
          postMessage: jest.fn().mockResolvedValue({})
        }
      };

      await checkAndAutoTaskUnreplied(mockSlackClient, 24);

      expect(mockSlackClient.chat.postMessage).toHaveBeenCalled();
    });

    test('should handle no unreplied mentions', async () => {
      const mockOrder = jest.fn().mockResolvedValue({ data: [], error: null });
      const mockLt = jest.fn().mockReturnValue({ order: mockOrder });
      const mockEq = jest.fn().mockReturnValue({ lt: mockLt });
      const mockIs = jest.fn().mockReturnValue({ eq: mockEq });
      const mockSelect = jest.fn().mockReturnValue({ is: mockIs });

      supabase.from.mockReturnValue({ select: mockSelect });

      const mockSlackClient = {
        chat: {
          postMessage: jest.fn()
        }
      };

      await checkAndAutoTaskUnreplied(mockSlackClient, 24);

      expect(mockSlackClient.chat.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('getUnrepliedStats', () => {
    test('should return statistics', async () => {
      // 各クエリに対して個別にモックチェーンを設定
      let callCount = 0;

      supabase.from.mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          // 1つ目のクエリ: unreplied (.is() -> .eq() chain)
          const mockEq = jest.fn().mockResolvedValue({ count: 5, error: null });
          const mockIs = jest.fn().mockReturnValue({ eq: mockEq });
          const mockSelect = jest.fn().mockReturnValue({ is: mockIs });
          return { select: mockSelect };
        } else if (callCount === 2) {
          // 2つ目のクエリ: autoTasked (.eq() only)
          const mockEq = jest.fn().mockResolvedValue({ count: 3, error: null });
          const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        } else if (callCount === 3) {
          // 3つ目のクエリ: replied (.not() chain)
          const mockNot = jest.fn().mockResolvedValue({ count: 10, error: null });
          const mockSelect = jest.fn().mockReturnValue({ not: mockNot });
          return { select: mockSelect };
        }
      });

      const result = await getUnrepliedStats();

      expect(result).toEqual({
        unreplied: 5,
        autoTasked: 3,
        replied: 10,
        total: 18
      });
    });

    test('should return zeros on database error', async () => {
      const mockError = new Error('Database error');
      const mockSelect = jest.fn().mockResolvedValue({ count: null, error: mockError });

      supabase.from.mockReturnValue({ select: mockSelect });

      const result = await getUnrepliedStats();

      expect(result).toEqual({
        unreplied: 0,
        autoTasked: 0,
        replied: 0,
        total: 0
      });
    });
  });
});
