# タスク16: Notion連携

**フェーズ**: Phase 6 - 将来機能
**難易度**: Complex
**推定時間**: 6時間以上
**依存関係**: タスク5（app.jsのリファクタリング）
**優先度**: 低（将来実装）

## 🎯 目標

Notion APIを使ってNotionデータベースとサポ田さんのタスクを双方向同期する。

## 📋 背景

多くのチームがNotionでプロジェクト管理をしています。サポ田さんのタスクをNotionと同期することで、Notion上でもタスクを管理できるようになります。

同期内容:
- **Slack → Notion**: サポ田さんで作成したタスクがNotionに自動作成
- **Notion → Slack**: Notionで作成・更新したタスクがSlackに通知

## ✅ 実装手順

### チェックリスト
- [ ] Notion統合を作成
- [ ] Notionデータベースを作成
- [ ] `@notionhq/client`をインストール
- [ ] Notion同期サービスを実装
- [ ] Webhookまたはポーリングで双方向同期
- [ ] 競合解決ロジックを実装
- [ ] 動作テストを実施

---

### Step 1: Notion統合の作成

1. **Notion統合ページにアクセス**
   - https://www.notion.so/my-integrations にアクセス
   - 「+ New integration」をクリック

2. **統合を作成**
   - Name: `Sapot-san Integration`
   - Associated workspace: 使用するワークスペースを選択
   - Capabilities: 「Read content」「Update content」「Insert content」を有効化
   - Submit

3. **Internal Integration Tokenを取得**
   - 生成されたトークンをコピー（`secret_...`で始まる）

4. **環境変数に追加**
   ```env
   NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxx
   NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Step 2: Notionデータベースの作成

1. **新しいページを作成**
   - Notionで新しいページを作成
   - 「Table - Full page」を選択

2. **プロパティを設定**
   - タスクID（Text）
   - タスク内容（Title）
   - ステータス（Select: 未完了, 完了）
   - 優先度（Select: 高, 中, 低）
   - 担当者（Text）
   - 期限（Date）
   - 作成日（Created time）
   - 要約（Text）
   - Slackリンク（URL）

3. **データベースIDを取得**
   - ブラウザのURL: `https://notion.so/xxxxxxxxxxxx?v=yyyy`
   - `xxxxxxxxxxxx`の部分がデータベースID

4. **統合を接続**
   - データベースページの右上「...」→ 「Add connections」
   - 作成した「Sapot-san Integration」を選択

### Step 3: Notion SDKのインストール

```bash
npm install @notionhq/client
```

### Step 4: Notion同期サービスの実装

`src/services/notionService.js`:

```javascript
const { Client } = require('@notionhq/client');
const logger = require('../utils/logger');

const notion = new Client({
  auth: process.env.NOTION_API_KEY
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID;

/**
 * サポ田さんのタスクをNotionに作成
 * @param {Object} task - タスクオブジェクト
 */
async function createNotionTask(task) {
  try {
    const response = await notion.pages.create({
      parent: {
        database_id: DATABASE_ID
      },
      properties: {
        'タスクID': {
          rich_text: [{
            text: {
              content: task.task_id
            }
          }]
        },
        'タスク内容': {
          title: [{
            text: {
              content: task.text
            }
          }]
        },
        'ステータス': {
          select: {
            name: task.status === 'open' ? '未完了' : '完了'
          }
        },
        '優先度': {
          select: {
            name: task.priority === 3 ? '高' : task.priority === 2 ? '中' : '低'
          }
        },
        '担当者': {
          rich_text: [{
            text: {
              content: task.assignee || ''
            }
          }]
        },
        '期限': task.due_date ? {
          date: {
            start: new Date(task.due_date).toISOString()
          }
        } : null,
        '要約': task.summary ? {
          rich_text: [{
            text: {
              content: task.summary
            }
          }]
        } : null,
        'Slackリンク': {
          url: `slack://channel?team=YOUR_TEAM_ID&id=${task.channel}&message=${task.message_ts}`
        }
      }
    });

    logger.success(`Notionタスク作成: ${task.task_id}`);
    return response.id; // Notion page ID
  } catch (error) {
    logger.failure('Notionタスク作成エラー', { error: error.message, task: task.task_id });
    throw error;
  }
}

/**
 * Notionのタスクをサポ田さんのDBに同期
 * @param {string} pageId - Notion page ID
 */
async function syncNotionToSupabase(pageId) {
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });

    // Notionのプロパティを取得
    const taskId = page.properties['タスクID'].rich_text[0]?.text.content;
    const text = page.properties['タスク内容'].title[0]?.text.content;
    const status = page.properties['ステータス'].select?.name === '完了' ? 'completed' : 'open';
    const priorityText = page.properties['優先度'].select?.name;
    const priority = priorityText === '高' ? 3 : priorityText === '中' ? 2 : 1;

    // Supabaseを更新
    const { supabase } = require('../db/connection');

    const { error } = await supabase
      .from('tasks')
      .update({
        status: status,
        priority: priority,
        // 他のフィールドも必要に応じて更新
      })
      .eq('task_id', taskId);

    if (error) throw error;

    logger.success(`Notion→Supabase同期完了: ${taskId}`);
  } catch (error) {
    logger.failure('Notion→Supabase同期エラー', { error: error.message });
    throw error;
  }
}

/**
 * Notionデータベースから全タスクを取得
 */
async function getAllNotionTasks() {
  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID
    });

    return response.results;
  } catch (error) {
    logger.failure('Notionタスク一覧取得エラー', { error: error.message });
    throw error;
  }
}

/**
 * Notionのタスクを更新
 * @param {string} pageId - Notion page ID
 * @param {Object} updates - 更新内容
 */
async function updateNotionTask(pageId, updates) {
  try {
    const properties = {};

    if (updates.status) {
      properties['ステータス'] = {
        select: {
          name: updates.status === 'open' ? '未完了' : '完了'
        }
      };
    }

    if (updates.priority) {
      properties['優先度'] = {
        select: {
          name: updates.priority === 3 ? '高' : updates.priority === 2 ? '中' : '低'
        }
      };
    }

    await notion.pages.update({
      page_id: pageId,
      properties: properties
    });

    logger.success(`Notionタスク更新: ${pageId}`);
  } catch (error) {
    logger.failure('Notionタスク更新エラー', { error: error.message });
    throw error;
  }
}

/**
 * 双方向同期: ポーリング方式
 * （Webhook方式も検討、ただしNotionのWebhookは制限あり）
 */
async function syncBidirectional(supabaseTasks) {
  try {
    logger.info('Notion双方向同期開始');

    // Notionの全タスクを取得
    const notionTasks = await getAllNotionTasks();

    // Supabaseにあってdにないタスク → Notionに作成
    for (const supabaseTask of supabaseTasks) {
      const existsInNotion = notionTasks.some(nt => {
        const taskId = nt.properties['タスクID'].rich_text[0]?.text.content;
        return taskId === supabaseTask.task_id;
      });

      if (!existsInNotion) {
        await createNotionTask(supabaseTask);
      }
    }

    // Notionで更新されたタスク → Supabaseに反映
    // （タイムスタンプを比較して最新の方を採用、競合解決）
    // ※簡略化のため省略、実装は複雑

    logger.success('Notion双方向同期完了');
  } catch (error) {
    logger.failure('Notion双方向同期エラー', { error: error.message });
  }
}

module.exports = {
  createNotionTask,
  syncNotionToSupabase,
  getAllNotionTasks,
  updateNotionTask,
  syncBidirectional
};
```

### Step 5: タスク作成時にNotionへ自動同期

`src/services/taskService.js`を修正:

```javascript
const notionService = require('./notionService');

async function createTask(taskData) {
  // 既存のタスク作成処理...
  const newTask = await /* ... */;

  // Notion同期（オプション、環境変数で制御）
  if (process.env.NOTION_SYNC_ENABLED === 'true') {
    try {
      await notionService.createNotionTask(newTask);
    } catch (error) {
      logger.warn('Notion同期失敗（タスク作成は成功）', { error: error.message });
    }
  }

  return newTask;
}
```

### Step 6: 定期的な双方向同期（cronジョブ）

`src/services/reminderService.js`に追加:

```javascript
const notionService = require('./notionService');
const taskService = require('./taskService');

function startReminderJobs(slackClient) {
  // 既存のcronジョブ...

  // 1時間ごとにNotion同期
  if (process.env.NOTION_SYNC_ENABLED === 'true') {
    cron.schedule('0 * * * *', async () => {
      logger.cron('Notion双方向同期開始');

      const supabaseTasks = await taskService.getTasks({ status: 'open' });
      await notionService.syncBidirectional(supabaseTasks);
    }, {
      timezone: 'Asia/Tokyo'
    });

    logger.info('✅ Notion同期cronジョブを開始しました');
  }
}
```

### Step 7: 環境変数の設定

`.env`:

```env
# Notion連携
NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxx
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_SYNC_ENABLED=true
```

### Step 8: 動作テスト

1. **サポ田さんでタスク作成**
   - Slackでリアクション → タスク作成
   - → Notionデータベースにタスクが作成される

2. **Notionでタスク更新**
   - Notionでステータスを「完了」に変更
   - → 1時間後（またはテスト用に手動実行）
   - → Supabaseのタスクも完了になる

3. **手動同期テスト**
   ```javascript
   // test-notion-sync.js
   const notionService = require('./src/services/notionService');
   const taskService = require('./src/services/taskService');

   (async () => {
     const tasks = await taskService.getTasks({ status: 'open' });
     await notionService.syncBidirectional(tasks);
   })();
   ```

## 📤 成果物

- ✅ Notion統合が作成されている
- ✅ Notionデータベースが設定されている
- ✅ `notionService.js`が実装されている
- ✅ タスク作成時にNotionへ自動同期される
- ✅ 定期的な双方向同期が動作する
- ✅ 競合解決ロジックが実装されている（基本的なもの）

## 🔍 確認方法

```bash
# アプリ起動
npm start

# Slackでタスク作成
@サポ田さん テストタスク

# Notionデータベースを確認
# → タスクが作成されている

# Notionでステータスを変更
# → 1時間後またはcron手動実行で同期

# 手動同期テスト
node test-notion-sync.js
```

## ⚠️ 注意点

1. **競合解決**
   - Supabaseとion両方で同時更新された場合
   - タイムスタンプを比較して最新の方を採用
   - または、Notionを真実の源（Source of Truth）とする

2. **Webhookの制限**
   - Notion APIは現在Webhookが限定的
   - ポーリング方式（1時間ごと）を推奨
   - 将来的にWebhookが充実すればリアルタイム同期可能

3. **レート制限**
   - Notion API: 3 requests/second
   - 大量のタスクがある場合はバッチ処理

4. **データ型の違い**
   - Slackのユーザー ID（U01234567）とNotionのユーザーは別
   - マッピングテーブルを作成することも検討

5. **削除の扱い**
   - Supabaseで削除されたタスクはNotionでもアーカイブ
   - 完全削除ではなくステータスを「削除」に変更

6. **パフォーマンス**
   - 初回同期は全タスクを処理するため時間がかかる
   - 差分同期（最終同期時刻以降のみ）を実装推奨

## 🚀 次のステップ

Phase 6（将来機能）完了！

全てのタスクドキュメントが完成しました。

---

## 📚 全タスク一覧

### Phase 1: データベース統合
1. [データベース選定と環境構築](./task-01-database-selection.md)
2. [タスクテーブルのスキーマ設計](./task-02-schema-design.md)
3. [データベース接続モジュールの実装](./task-03-database-connection.md)
4. [タスクサービス層の実装](./task-04-task-service.md)
5. [app.jsのリファクタリング](./task-05-app-refactoring.md)

### Phase 2: 期限管理とリマインド
6. [期限管理機能の設計](./task-06-deadline-management.md)
7. [リマインダーサービスの実装](./task-07-reminder-service.md)

### Phase 3: AI統合
9. [OpenAI API統合の準備](./task-09-openai-setup.md)
10. [AIサービス層の実装](./task-10-ai-service.md)
11. [AI機能のSlack統合](./task-11-ai-slack-integration.md)

### Phase 4: 未返信メッセージ検知
8. [未返信メッセージ検知機能](./task-08-unreplied-detection.md)

### Phase 5: 品質改善
12. [ログ管理システムの実装](./task-12-logging-system.md)
13. [エラーハンドリングの強化](./task-13-error-handling.md)
14. [テストコードの作成](./task-14-testing.md)

### Phase 6: 将来機能
15. [Webポータルの基盤構築](./task-15-web-portal.md)
16. [Notion連携](./task-16-notion-integration.md)

次にどのフェーズから始めるか選んでください！
