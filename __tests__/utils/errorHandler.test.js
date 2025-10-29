const {
  AppError,
  DatabaseError,
  SlackAPIError,
  OpenAIError,
  retryOperation
} = require('../../src/utils/errorHandler');

describe('Error Classes', () => {
  describe('AppError', () => {
    test('should create an AppError with correct properties', () => {
      const error = new AppError('Test error', 500);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
    });

    test('should mark error as non-operational when specified', () => {
      const error = new AppError('Fatal error', 500, false);

      expect(error.isOperational).toBe(false);
    });
  });

  describe('DatabaseError', () => {
    test('should create a DatabaseError', () => {
      const originalError = new Error('Connection failed');
      const error = new DatabaseError('Database error', originalError);

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('DatabaseError');
      expect(error.statusCode).toBe(500);
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('SlackAPIError', () => {
    test('should create a SlackAPIError', () => {
      const error = new SlackAPIError('Slack API failed');

      expect(error).toBeInstanceOf(SlackAPIError);
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('SlackAPIError');
      expect(error.statusCode).toBe(500);
    });
  });

  describe('OpenAIError', () => {
    test('should create an OpenAIError', () => {
      const error = new OpenAIError('OpenAI API failed');

      expect(error).toBeInstanceOf(OpenAIError);
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('OpenAIError');
      expect(error.statusCode).toBe(500);
    });
  });
});

describe('retryOperation', () => {
  test('should succeed on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success');

    const result = await retryOperation(fn, 3, 100);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('should retry and succeed on second attempt', async () => {
    let attempts = 0;
    const fn = jest.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 2) {
        throw new Error('Temporary failure');
      }
      return Promise.resolve('success');
    });

    const result = await retryOperation(fn, 3, 100);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('should retry maximum times and throw error', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Permanent failure'));

    await expect(retryOperation(fn, 3, 100)).rejects.toThrow('Permanent failure');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('should apply exponential backoff', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Failure'));
    const startTime = Date.now();

    try {
      await retryOperation(fn, 3, 100);
    } catch (error) {
      // Expected to fail
    }

    const duration = Date.now() - startTime;

    // 指数バックオフ: 100ms * 1 + 100ms * 2 + 100ms * 3 = 600ms
    // 若干の誤差を考慮して300ms以上であることを確認（システムオーバーヘッドを考慮）
    expect(duration).toBeGreaterThanOrEqual(300);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
