// OpenAIをモック
const mockCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate
      }
    }
  }));
});

const {
  summarizeThread,
  determinePriority,
  formatTaskText,
  suggestAssignee,
  fetchThreadMessages
} = require('../../src/services/aiService');

describe('AIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockReset();
  });

  describe('summarizeThread', () => {
    test('should summarize thread messages successfully', async () => {
      const mockMessages = [
        { text: 'バグを発見しました', user: 'U123', ts: '1234.567' },
        { text: '対応します', user: 'U456', ts: '1234.568' }
      ];

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '- バグの報告\n- 対応予定' } }]
      });

      const result = await summarizeThread(mockMessages);

      expect(result).toBe('- バグの報告\n- 対応予定');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(String),
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' })
          ])
        })
      );
    });

    test('should return default message for empty thread', async () => {
      const result = await summarizeThread([]);

      expect(result).toBe('スレッドが空です');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    test('should handle API errors gracefully', async () => {
      const mockMessages = [
        { text: 'テストメッセージ', user: 'U123', ts: '1234.567' }
      ];

      mockCreate.mockRejectedValue(
        new Error('API Error')
      );

      const result = await summarizeThread(mockMessages);

      expect(result).toBe('スレッドの要約に失敗しました');
    });
  });

  describe('determinePriority', () => {
    test('should return high priority for tasks due within 24 hours', async () => {
      const dueDate = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12時間後

      const result = await determinePriority('緊急タスク', dueDate);

      expect(result).toBe(1);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    test('should return medium priority for tasks due within 72 hours', async () => {
      const dueDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48時間後

      const result = await determinePriority('通常タスク', dueDate);

      expect(result).toBe(2);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    test('should use AI to determine priority for tasks with distant deadlines', async () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7日後

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '3' } }]
      });

      const result = await determinePriority('低優先度タスク', dueDate);

      expect(result).toBe(3);
      expect(mockCreate).toHaveBeenCalled();
    });

    test('should use AI to determine priority when no due date provided', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '1' } }]
      });

      const result = await determinePriority('バグ修正が必要');

      expect(result).toBe(1);
      expect(mockCreate).toHaveBeenCalled();
    });

    test('should return default priority on AI error', async () => {
      mockCreate.mockRejectedValue(
        new Error('API Error')
      );

      const result = await determinePriority('タスク');

      expect(result).toBe(2); // デフォルトは中優先度
    });

    test('should return default priority for invalid AI response', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'invalid' } }]
      });

      const result = await determinePriority('タスク');

      expect(result).toBe(2);
    });
  });

  describe('formatTaskText', () => {
    test('should format task text successfully', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'バグを修正する' } }]
      });

      const result = await formatTaskText('バグがあるから直してほしい');

      expect(result).toBe('バグを修正する');
      expect(mockCreate).toHaveBeenCalled();
    });

    test('should return default message for empty text', async () => {
      const result = await formatTaskText('');

      expect(result).toBe('（タスク内容なし）');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    test('should return original text on API error', async () => {
      const originalText = 'テストタスク';

      mockCreate.mockRejectedValue(
        new Error('API Error')
      );

      const result = await formatTaskText(originalText);

      expect(result).toBe(originalText);
    });
  });

  describe('suggestAssignee', () => {
    test('should suggest user with most messages', async () => {
      const mockMessages = [
        { text: 'メッセージ1', user: 'U123', ts: '1234.567' },
        { text: 'メッセージ2', user: 'U456', ts: '1234.568' },
        { text: 'メッセージ3', user: 'U123', ts: '1234.569' },
        { text: 'メッセージ4', user: 'U123', ts: '1234.570' }
      ];

      const result = await suggestAssignee(mockMessages);

      expect(result).toBe('U123');
    });

    test('should return null for empty messages', async () => {
      const result = await suggestAssignee([]);

      expect(result).toBeNull();
    });

    test('should handle messages without user field', async () => {
      const mockMessages = [
        { text: 'メッセージ1', ts: '1234.567' }, // userなし
        { text: 'メッセージ2', user: 'U123', ts: '1234.568' }
      ];

      const result = await suggestAssignee(mockMessages);

      expect(result).toBe('U123');
    });
  });

  describe('fetchThreadMessages', () => {
    test('should fetch thread messages successfully', async () => {
      const mockSlackClient = {
        conversations: {
          replies: jest.fn().mockResolvedValue({
            messages: [
              { text: 'メッセージ1', user: 'U123', ts: '1234.567' },
              { text: 'メッセージ2', user: 'U456', ts: '1234.568' }
            ]
          })
        }
      };

      const result = await fetchThreadMessages(mockSlackClient, 'C123', '1234.567');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        text: 'メッセージ1',
        user: 'U123',
        ts: '1234.567'
      });
      expect(mockSlackClient.conversations.replies).toHaveBeenCalledWith({
        channel: 'C123',
        ts: '1234.567'
      });
    });

    test('should return empty array when no messages found', async () => {
      const mockSlackClient = {
        conversations: {
          replies: jest.fn().mockResolvedValue({
            messages: []
          })
        }
      };

      const result = await fetchThreadMessages(mockSlackClient, 'C123', '1234.567');

      expect(result).toEqual([]);
    });

    test('should handle API errors', async () => {
      const mockSlackClient = {
        conversations: {
          replies: jest.fn().mockRejectedValue(new Error('Slack API Error'))
        }
      };

      const result = await fetchThreadMessages(mockSlackClient, 'C123', '1234.567');

      expect(result).toEqual([]);
    });
  });
});
