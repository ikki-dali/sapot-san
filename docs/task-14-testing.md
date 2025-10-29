# タスク14: テストコードの作成

**フェーズ**: Phase 5 - 品質改善
**難易度**: Complex
**推定時間**: 4時間
**依存関係**: タスク5（app.jsのリファクタリング）、タスク7（リマインダーサービス）、タスク10（AIサービス）

## 🎯 目標

Jest/Mochaでユニットテスト、統合テストを実装し、カバレッジ80%以上を達成する。

## 📋 背景

テストコードを書くことで：
- リファクタリング時の安心感
- バグの早期発見
- コードの品質向上
- ドキュメントとしての役割

を実現します。

## ✅ 実装手順

### チェックリスト
- [ ] Jestをインストール・設定
- [ ] taskServiceのユニットテストを作成
- [ ] aiServiceのユニットテストを作成
- [ ] reminderServiceのユニットテストを作成
- [ ] 統合テストを作成
- [ ] カバレッジレポートを確認
- [ ] CIに統合（オプション）

---

### Step 1: Jestのインストールと設定

```bash
npm install --save-dev jest @types/jest
```

`package.json`に追加:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "testEnvironment": "node",
    "coverageDirectory": "coverage",
    "collectCoverageFrom": [
      "src/**/*.js",
      "!src/**/*.test.js",
      "!src/**/index.js"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

### Step 2: taskServiceのユニットテスト

`src/services/taskService.test.js`:

```javascript
const taskService = require('./taskService');
const { supabase } = require('../db/connection');

// Supabaseクライアントをモック
jest.mock('../db/connection', () => ({
  supabase: {
    from: jest.fn()
  }
}));

describe('taskService', () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('タスクを正常に作成できる', async () => {
      // モックの戻り値を設定
      const mockTask = {
        id: 1,
        task_id: 'task_123',
        text: 'テストタスク',
        status: 'open'
      };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockTask,
              error: null
            })
          })
        })
      });

      // テスト実行
      const result = await taskService.createTask({
        text: 'テストタスク',
        channel: 'C123',
        messageTs: '123.456',
        createdBy: 'U123',
        assignee: 'U456'
      });

      // 検証
      expect(result.text).toBe('テストタスク');
      expect(result.status).toBe('open');
      expect(supabase.from).toHaveBeenCalledWith('tasks');
    });

    it('データベースエラー時に例外を投げる', async () => {
      // エラーを返すモック
      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });

      // エラーが投げられることを検証
      await expect(
        taskService.createTask({
          text: 'テストタスク',
          channel: 'C123',
          messageTs: '123.456',
          createdBy: 'U123',
          assignee: 'U456'
        })
      ).rejects.toThrow();
    });
  });

  describe('getTaskById', () => {
    it('タスクIDでタスクを取得できる', async () => {
      const mockTask = {
        task_id: 'task_123',
        text: 'テストタスク'
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockTask,
              error: null
            })
          })
        })
      });

      const result = await taskService.getTaskById('task_123');

      expect(result.task_id).toBe('task_123');
      expect(result.text).toBe('テストタスク');
    });

    it('タスクが見つからない場合nullを返す', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' } // No rows found
            })
          })
        })
      });

      const result = await taskService.getTaskById('task_notfound');

      expect(result).toBeNull();
    });
  });

  describe('completeTask', () => {
    it('タスクを完了状態にできる', async () => {
      const mockCompletedTask = {
        task_id: 'task_123',
        status: 'completed',
        completed_by: 'U123'
      };

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockCompletedTask,
                error: null
              })
            })
          })
        })
      });

      const result = await taskService.completeTask('task_123', 'U123');

      expect(result.status).toBe('completed');
      expect(result.completed_by).toBe('U123');
    });
  });
});
```

### Step 3: aiServiceのユニットテスト

`src/services/aiService.test.js`:

```javascript
const aiService = require('./aiService');
const OpenAI = require('openai');

// OpenAIクライアントをモック
jest.mock('openai');

describe('aiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('summarizeThread', () => {
    it('スレッドを正常に要約できる', async () => {
      // OpenAI APIのモックレスポンス
      const mockResponse = {
        choices: [{
          message: {
            content: '要約: ユーザーAがタスクを依頼し、ユーザーBが承諾した。'
          }
        }],
        usage: {
          total_tokens: 150
        }
      };

      OpenAI.prototype.chat = {
        completions: {
          create: jest.fn().mockResolvedValue(mockResponse)
        }
      };

      const messages = [
        { user: 'U001', text: 'タスクをお願いします' },
        { user: 'U002', text: 'かしこまりました' }
      ];

      const result = await aiService.summarizeThread(messages);

      expect(result).toContain('要約');
      expect(OpenAI.prototype.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it('OpenAI APIエラー時にnullを返す', async () => {
      OpenAI.prototype.chat = {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('API error'))
        }
      };

      const messages = [{ user: 'U001', text: 'テスト' }];

      const result = await aiService.summarizeThread(messages);

      expect(result).toBeNull();
    });
  });

  describe('determinePriority', () => {
    it('緊急タスクを高優先度と判定できる', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '3'
          }
        }],
        usage: {
          total_tokens: 10
        }
      };

      OpenAI.prototype.chat = {
        completions: {
          create: jest.fn().mockResolvedValue(mockResponse)
        }
      };

      const result = await aiService.determinePriority('緊急！本番環境でエラー');

      expect(result).toBe(3);
    });

    it('通常タスクを中優先度と判定できる', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '2'
          }
        }]
      };

      OpenAI.prototype.chat = {
        completions: {
          create: jest.fn().mockResolvedValue(mockResponse)
        }
      };

      const result = await aiService.determinePriority('資料を作成してください');

      expect(result).toBe(2);
    });

    it('不正な優先度が返された場合デフォルト2を返す', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '不正な値'
          }
        }]
      };

      OpenAI.prototype.chat = {
        completions: {
          create: jest.fn().mockResolvedValue(mockResponse)
        }
      };

      const result = await aiService.determinePriority('タスク');

      expect(result).toBe(2);
    });
  });
});
```

### Step 4: reminderServiceのユニットテスト

`src/services/reminderService.test.js`:

```javascript
const reminderService = require('./reminderService');
const taskService = require('./taskService');

jest.mock('./taskService');

describe('reminderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkUpcomingDeadlines', () => {
    it('期限が近いタスクを正常に取得できる', async () => {
      const mockTasks = [
        {
          task_id: 'task_123',
          text: 'テストタスク',
          due_date: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12時間後
          channel: 'C123',
          assignee: 'U123'
        }
      ];

      taskService.getUpcomingTasks = jest.fn().mockResolvedValue(mockTasks);

      const mockSlackClient = {
        chat: {
          postMessage: jest.fn().mockResolvedValue({ ok: true })
        }
      };

      await reminderService.checkUpcomingDeadlines(mockSlackClient, 24);

      expect(taskService.getUpcomingTasks).toHaveBeenCalledWith(24);
      expect(mockSlackClient.chat.postMessage).toHaveBeenCalledTimes(1);
    });

    it('期限が近いタスクがない場合は通知しない', async () => {
      taskService.getUpcomingTasks = jest.fn().mockResolvedValue([]);

      const mockSlackClient = {
        chat: {
          postMessage: jest.fn()
        }
      };

      await reminderService.checkUpcomingDeadlines(mockSlackClient, 24);

      expect(mockSlackClient.chat.postMessage).not.toHaveBeenCalled();
    });
  });
});
```

### Step 5: 統合テスト

`tests/integration/task-flow.test.js`:

```javascript
const taskService = require('../../src/services/taskService');
const { supabase } = require('../../src/db/connection');

// 統合テストは実際のデータベースを使用（テスト用DBを推奨）
describe('Task Flow Integration Tests', () => {
  let createdTaskId;

  // テスト後のクリーンアップ
  afterAll(async () => {
    if (createdTaskId) {
      await supabase.from('tasks').delete().eq('task_id', createdTaskId);
    }
  });

  it('タスクの作成→取得→完了のフロー', async () => {
    // 1. タスク作成
    const newTask = await taskService.createTask({
      text: '統合テスト用タスク',
      channel: 'C_TEST',
      messageTs: 'test_123',
      createdBy: 'U_TEST',
      assignee: 'U_TEST'
    });

    createdTaskId = newTask.task_id;

    expect(newTask).toBeDefined();
    expect(newTask.status).toBe('open');

    // 2. タスク取得
    const fetchedTask = await taskService.getTaskById(newTask.task_id);

    expect(fetchedTask).toBeDefined();
    expect(fetchedTask.text).toBe('統合テスト用タスク');

    // 3. タスク完了
    const completedTask = await taskService.completeTask(newTask.task_id, 'U_TEST');

    expect(completedTask.status).toBe('completed');
    expect(completedTask.completed_by).toBe('U_TEST');
  });
});
```

### Step 6: テストの実行

```bash
# 全テスト実行
npm test

# ウォッチモード（ファイル変更時に自動実行）
npm run test:watch

# カバレッジレポート生成
npm run test:coverage
```

### Step 7: CI/CDへの統合（オプション）

`.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm ci

    - name: Run tests
      run: npm test

    - name: Generate coverage report
      run: npm run test:coverage

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/coverage-final.json
```

## 📤 成果物

- ✅ Jestがインストール・設定されている
- ✅ taskServiceのユニットテストが実装されている
- ✅ aiServiceのユニットテストが実装されている
- ✅ reminderServiceのユニットテストが実装されている
- ✅ 統合テストが実装されている
- ✅ カバレッジ80%以上を達成
- ✅ CIに統合されている（オプション）

## 🔍 確認方法

```bash
# テスト実行
npm test

# 出力例:
# PASS  src/services/taskService.test.js
#   taskService
#     createTask
#       ✓ タスクを正常に作成できる (25ms)
#       ✓ データベースエラー時に例外を投げる (10ms)
#     getTaskById
#       ✓ タスクIDでタスクを取得できる (8ms)
#       ✓ タスクが見つからない場合nullを返す (5ms)
#
# Test Suites: 3 passed, 3 total
# Tests:       15 passed, 15 total
# Coverage:    85.2%

# カバレッジレポート
npm run test:coverage
# → coverage/lcov-report/index.html が生成される
```

## ⚠️ 注意点

1. **モックの使い分け**
   - ユニットテスト: 外部依存をモック
   - 統合テスト: 実際のデータベース使用（テスト用DB推奨）

2. **テストデータのクリーンアップ**
   - `afterEach`, `afterAll`でテストデータを削除
   - テスト用データベースの使用を推奨

3. **非同期処理のテスト**
   - `async/await`を使用
   - `resolves`, `rejects`マッチャーを活用

4. **カバレッジの目標**
   - 80%以上を目標
   - 重要なビジネスロジックは100%を目指す

5. **テストの実行時間**
   - ユニットテストは高速（数秒）
   - 統合テストは遅い（数十秒〜数分）
   - CIでは両方実行

## 🚀 次のステップ

Phase 5（品質改善）完了！

→ [タスク15: Webポータルの基盤構築](./task-15-web-portal.md)
