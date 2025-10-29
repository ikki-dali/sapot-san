const logger = require('../../src/utils/logger');

describe('Logger', () => {
  // ログ出力をキャプチャするためのスパイ
  let infoSpy, warnSpy, errorSpy;

  beforeEach(() => {
    // winstonのログメソッドをモック
    infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // スパイをリストア
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('Basic logging methods', () => {
    test('should log info messages', () => {
      logger.info('Test info message');

      expect(infoSpy).toHaveBeenCalledWith('Test info message');
      expect(infoSpy).toHaveBeenCalledTimes(1);
    });

    test('should log warn messages', () => {
      logger.warn('Test warning message');

      expect(warnSpy).toHaveBeenCalledWith('Test warning message');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    test('should log error messages', () => {
      logger.error('Test error message');

      expect(errorSpy).toHaveBeenCalledWith('Test error message');
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    test('should log with metadata', () => {
      const metadata = { userId: '123', action: 'test' };
      logger.info('Test with metadata', metadata);

      expect(infoSpy).toHaveBeenCalledWith('Test with metadata', metadata);
    });
  });

  describe('Custom log helpers', () => {
    test('should log task messages', () => {
      logger.task('Task created', { taskId: 'task_123' });

      expect(infoSpy).toHaveBeenCalledWith('📋 Task created', { taskId: 'task_123' });
    });

    test('should log slack messages', () => {
      logger.slack('Message sent', { channel: 'C123' });

      expect(infoSpy).toHaveBeenCalledWith('💬 Message sent', { channel: 'C123' });
    });

    test('should log database operations', () => {
      logger.db('Query executed', { query: 'SELECT *' });

      expect(infoSpy).toHaveBeenCalledWith('🗄️ Query executed', { query: 'SELECT *' });
    });

    test('should log AI operations', () => {
      logger.ai('AI processing complete', { tokens: 100 });

      expect(infoSpy).toHaveBeenCalledWith('🤖 AI processing complete', { tokens: 100 });
    });

    test('should log cron jobs', () => {
      logger.cron('Cron job executed', { job: 'reminder' });

      expect(infoSpy).toHaveBeenCalledWith('⏰ Cron job executed', { job: 'reminder' });
    });

    test('should log success messages', () => {
      logger.success('Operation successful');

      expect(infoSpy).toHaveBeenCalledWith('✅ Operation successful', {});
    });

    test('should log failure messages', () => {
      logger.failure('Operation failed', { error: 'Test error' });

      expect(errorSpy).toHaveBeenCalledWith('❌ Operation failed', { error: 'Test error' });
    });
  });
});
