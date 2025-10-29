# タグ機能 - 実装ガイド

## 実装済みの内容

### ✅ 完了した項目

1. **データベーススキーマ**
   - `tags` テーブル（タグマスター）
   - `task_tags` テーブル（タスクとタグの中間テーブル）
   - デフォルトタグ7種類（緊急、重要、バグ、機能追加、改善、質問、レビュー待ち）

2. **バックエンドAPI**
   - `GET /api/tags` - 全タグ一覧取得
   - `POST /api/tags` - タグ作成
   - `DELETE /api/tags/:id` - タグ削除
   - `POST /api/tags/task/:taskId` - タスクにタグ追加
   - `DELETE /api/tags/task/:taskId/:tagId` - タスクからタグ削除
   - `GET /api/tags/task/:taskId` - タスクのタグ一覧取得

3. **タスクAPI拡張**
   - タスク一覧取得時にタグ情報を含める
   - タスク詳細取得時にタグ情報を含める
   - タスク作成時にタグIDを指定可能

4. **ダッシュボード**
   - タスク一覧にタグバッジを表示（色付き）

## ⚠️ 未完了の項目（次のステップ）

### 1. データベースマイグレーション実行 **（最優先）**

Supabaseダッシュボードで以下のSQLを実行してください：

```bash
# マイグレーションファイル: migrations/003_create_tags_tables.sql
```

**手順:**
1. Supabaseダッシュボードを開く
2. SQL Editorに移動
3. `migrations/003_create_tags_tables.sql` の内容をコピー&ペースト
4. 「Run」を実行

### 2. Slackコマンドでタグ操作（未実装）

以下のSlackコマンドを実装する必要があります：

#### 実装予定のコマンド

- `/task-tag-add [task_id] [tag_name]` - タスクにタグを追加
- `/task-tag-remove [task_id] [tag_name]` - タスクからタグを削除
- `/task-tag-list [task_id]` - タスクのタグ一覧表示
- `/tag-list` - 全タグ一覧表示
- `/tag-create [name] [color]` - 新しいタグを作成

#### 実装方法（app.jsに追加）

```javascript
// タグ一覧コマンド
app.command('/tag-list', async ({ command, ack, say }) => {
  await ack();

  const tags = await tagService.getAllTags();

  const tagList = tags.map(tag =>
    `• ${tag.name} (色: ${tag.color})`
  ).join('\n');

  await say({
    text: `📋 *タグ一覧*\n\n${tagList}`
  });
});

// タスクにタグ追加コマンド
app.command('/task-tag-add', async ({ command, ack, say }) => {
  await ack();

  const [taskId, tagName] = command.text.split(' ');

  // タグ名からタグIDを取得
  const tags = await tagService.getAllTags();
  const tag = tags.find(t => t.name === tagName);

  if (!tag) {
    await say(`❌ タグ「${tagName}」が見つかりません`);
    return;
  }

  await tagService.addTagsToTask(taskId, [tag.id]);
  await say(`✅ タスク ${taskId} にタグ「${tagName}」を追加しました`);
});

// その他のコマンドも同様に実装...
```

### 3. フィルタリング機能（オプション）

ダッシュボードにタグでフィルタリングする機能を追加すると便利です。

**実装例:**
```javascript
// タグフィルタボタンを追加
async function filterByTag(tagId) {
  const response = await fetch(`${API_URL}/tasks?status=open`);
  const result = await response.json();

  // タグでフィルタリング
  const filtered = result.data.filter(task =>
    task.tags.some(tag => tag.id === tagId)
  );

  // 結果を表示
  renderTasks(filtered);
}
```

## 📝 データベーススキーマ

### tags テーブル
| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | SERIAL PRIMARY KEY | タグID |
| name | VARCHAR(50) UNIQUE | タグ名（重複不可） |
| color | VARCHAR(7) | タグの色（HEX形式） |
| created_at | TIMESTAMP | 作成日時 |

### task_tags テーブル
| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | SERIAL PRIMARY KEY | レコードID |
| task_id | VARCHAR(255) | タスクID |
| tag_id | INTEGER | タグID（外部キー） |
| created_at | TIMESTAMP | 作成日時 |

**制約:**
- `UNIQUE(task_id, tag_id)` - 同じタスクに同じタグを重複追加できない
- `FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE` - タグ削除時に自動で中間テーブルも削除

## デフォルトタグ一覧

| タグ名 | 色 | 用途 |
|--------|-----|------|
| 緊急 | #dc3545 (赤) | 最優先で対応が必要なタスク |
| 重要 | #fd7e14 (オレンジ) | 重要度が高いタスク |
| バグ | #e83e8c (ピンク) | バグ修正タスク |
| 機能追加 | #0d6efd (青) | 新機能の実装 |
| 改善 | #20c997 (緑) | 既存機能の改善 |
| 質問 | #6f42c1 (紫) | 質問・確認が必要なタスク |
| レビュー待ち | #ffc107 (黄) | レビュー待ちのタスク |

## テストAPI呼び出し例

### タグ一覧取得
```bash
curl http://localhost:3000/api/tags
```

### タグ作成
```bash
curl -X POST http://localhost:3000/api/tags \
  -H "Content-Type: application/json" \
  -d '{"name": "テスト", "color": "#00ff00"}'
```

### タスクにタグ追加
```bash
curl -X POST http://localhost:3000/api/tags/task/TASK-123 \
  -H "Content-Type: application/json" \
  -d '{"tagIds": [1, 2, 3]}'
```

### タスクのタグ取得
```bash
curl http://localhost:3000/api/tags/task/TASK-123
```

## 今後の拡張案

1. **タグの統計表示** - どのタグが最も使われているか
2. **タグによるタスク検索** - 特定のタグが付いたタスク一覧
3. **タグの色編集** - 既存タグの色を変更する機能
4. **タグの並び替え** - よく使うタグを上位に表示
5. **タグのアイコン** - 色だけでなくアイコンも設定可能に
