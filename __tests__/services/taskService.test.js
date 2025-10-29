// Supabaseをモック
jest.mock('../../src/db/connection', () => ({
  supabase: {
    from: jest.fn()
  }
}));

const { supabase } = require('../../src/db/connection');
const {
  createTask,
  getTaskById,
  getTasks,
  completeTask,
  updateTask,
  deleteTask,
  getUpcomingTasks
} = require('../../src/services/taskService');

describe('TaskService', () => {
  // 各テストの前にモックをリセット
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    test('should create a new task successfully', async () => {
      const mockTask = {
        task_id: 'task_1234567890',
        text: 'テストタスク',
        channel: 'C123456',
        message_ts: '1234567890.123456',
        created_by: 'U123456',
        assignee: 'U654321',
        status: 'open',
        priority: 2
      };

      // Supabaseのモックチェーンを設定
      const mockSelect = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({ data: mockTask, error: null });
      const mockInsert = jest.fn().mockReturnValue({
        select: mockSelect,
        single: mockSingle
      });

      supabase.from.mockReturnValue({
        insert: mockInsert
      });

      const taskData = {
        text: 'テストタスク',
        channel: 'C123456',
        messageTs: '1234567890.123456',
        createdBy: 'U123456',
        assignee: 'U654321'
      };

      const result = await createTask(taskData);

      expect(supabase.from).toHaveBeenCalledWith('tasks');
      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(mockTask);
    });

    test('should throw error when task creation fails', async () => {
      const mockError = new Error('Database error');

      const mockSelect = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: mockError });
      const mockInsert = jest.fn().mockReturnValue({
        select: mockSelect,
        single: mockSingle
      });

      supabase.from.mockReturnValue({
        insert: mockInsert
      });

      const taskData = {
        text: 'テストタスク',
        channel: 'C123456',
        messageTs: '1234567890.123456',
        createdBy: 'U123456',
        assignee: 'U654321'
      };

      await expect(createTask(taskData)).rejects.toThrow('Database error');
    });
  });

  describe('getTaskById', () => {
    test('should get a task by ID', async () => {
      const mockTask = {
        task_id: 'task_123',
        text: 'テストタスク',
        status: 'open'
      };

      const mockSingle = jest.fn().mockResolvedValue({ data: mockTask, error: null });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      supabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await getTaskById('task_123');

      expect(supabase.from).toHaveBeenCalledWith('tasks');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('task_id', 'task_123');
      expect(result).toEqual(mockTask);
    });

    test('should return null when task not found', async () => {
      const mockError = { code: 'PGRST116' }; // No rows found

      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: mockError });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      supabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await getTaskById('task_nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getTasks', () => {
    test('should get all open tasks by default', async () => {
      const mockTasks = [
        { task_id: 'task_1', text: 'タスク1', status: 'open' },
        { task_id: 'task_2', text: 'タスク2', status: 'open' }
      ];

      const mockEq = jest.fn().mockResolvedValue({ data: mockTasks, error: null });
      const mockOrder = jest.fn().mockReturnValue({ eq: mockEq });
      const mockSelect = jest.fn().mockReturnValue({ order: mockOrder });

      supabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await getTasks();

      expect(supabase.from).toHaveBeenCalledWith('tasks');
      expect(result).toEqual(mockTasks);
      expect(result).toHaveLength(2);
    });

    test('should filter tasks by assignee', async () => {
      const mockTasks = [
        { task_id: 'task_1', text: 'タスク1', assignee: 'U123' }
      ];

      const mockEq2 = jest.fn().mockResolvedValue({ data: mockTasks, error: null });
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
      const mockOrder = jest.fn().mockReturnValue({ eq: mockEq1 });
      const mockSelect = jest.fn().mockReturnValue({ order: mockOrder });

      supabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await getTasks({ assignee: 'U123' });

      expect(result).toEqual(mockTasks);
    });
  });

  describe('completeTask', () => {
    test('should mark a task as completed', async () => {
      const mockCompletedTask = {
        task_id: 'task_123',
        status: 'completed',
        completed_by: 'U123',
        completed_at: expect.any(String)
      };

      const mockSingle = jest.fn().mockResolvedValue({ data: mockCompletedTask, error: null });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });

      supabase.from.mockReturnValue({
        update: mockUpdate
      });

      const result = await completeTask('task_123', 'U123');

      expect(supabase.from).toHaveBeenCalledWith('tasks');
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: 'completed',
        completed_by: 'U123'
      }));
      expect(result.status).toBe('completed');
    });
  });

  describe('updateTask', () => {
    test('should update task fields', async () => {
      const mockUpdatedTask = {
        task_id: 'task_123',
        text: '更新されたタスク',
        priority: 3
      };

      const mockSingle = jest.fn().mockResolvedValue({ data: mockUpdatedTask, error: null });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });

      supabase.from.mockReturnValue({
        update: mockUpdate
      });

      const updates = { text: '更新されたタスク', priority: 3 };
      const result = await updateTask('task_123', updates);

      expect(mockUpdate).toHaveBeenCalledWith(updates);
      expect(result).toEqual(mockUpdatedTask);
    });
  });

  describe('deleteTask', () => {
    test('should delete a task', async () => {
      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockEq });

      supabase.from.mockReturnValue({
        delete: mockDelete
      });

      const result = await deleteTask('task_123');

      expect(supabase.from).toHaveBeenCalledWith('tasks');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('task_id', 'task_123');
      expect(result).toBe(true);
    });
  });

  describe('getUpcomingTasks', () => {
    test('should get tasks with upcoming deadlines', async () => {
      const mockTasks = [
        { task_id: 'task_1', text: 'タスク1', due_date: new Date().toISOString() }
      ];

      const mockOrder = jest.fn().mockResolvedValue({ data: mockTasks, error: null });
      const mockLte = jest.fn().mockReturnValue({ order: mockOrder });
      const mockGte = jest.fn().mockReturnValue({ lte: mockLte });
      const mockEq = jest.fn().mockReturnValue({ gte: mockGte });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      supabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await getUpcomingTasks(24);

      expect(supabase.from).toHaveBeenCalledWith('tasks');
      expect(result).toEqual(mockTasks);
    });
  });
});
