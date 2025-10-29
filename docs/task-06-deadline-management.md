# タスク6: 期限管理機能の設計

**フェーズ**: Phase 2 - 期限管理とリマインド
**難易度**: Medium
**推定時間**: 2時間
**依存関係**: タスク5（app.jsのリファクタリング）

## 🎯 目標

タスク作成時に期限（due_date）を設定できるモーダルUIを実装する。

## 📋 背景

現在のタスク作成はリアクションのみですが、期限を設定できるようにすることで、より実用的なタスク管理が可能になります。Slack Block Kitを使った対話的なモーダルUIを実装します。

## ✅ 実装手順

### チェックリスト
- [ ] グローバルショートカットを作成（🔧 ユーザー手動設定が必要）
- [x] モーダルUIを設計（Block Kit使用）
- [x] モーダル送信ハンドラーを実装
- [x] 期限付きタスク作成機能を実装
- [x] /task-listコマンドに期限表示機能を追加
- [ ] Slackアプリのmanifestを更新（🔧 ユーザー手動設定が必要）
- [x] 動作テスト（バックエンド）を実施

---

### Step 1: Slackアプリにショートカットを追加

Slackアプリの設定ページ（https://api.slack.com/apps）で：

1. **Interactivity & Shortcuts** → **Create New Shortcut**
2. **Global Shortcut**を選択
3. 以下の情報を入力:
   - Name: `Create Task with Deadline`
   - Short Description: `期限付きタスクを作成`
   - Callback ID: `create_task_modal`

### Step 2: モーダルUIの設計

`app.js`にグローバルショートカットのハンドラーを追加:

```javascript
// グローバルショートカット: タスク作成モーダルを開く
app.shortcut('create_task_modal', async ({ shortcut, ack, client }) => {
  await ack();

  try {
    await client.views.open({
      trigger_id: shortcut.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'task_modal_submit',
        title: {
          type: 'plain_text',
          text: 'タスク作成'
        },
        submit: {
          type: 'plain_text',
          text: '作成'
        },
        close: {
          type: 'plain_text',
          text: 'キャンセル'
        },
        blocks: [
          {
            type: 'input',
            block_id: 'task_text',
            label: {
              type: 'plain_text',
              text: 'タスク内容'
            },
            element: {
              type: 'plain_text_input',
              action_id: 'text_input',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'やることを入力してください'
              }
            }
          },
          {
            type: 'input',
            block_id: 'assignee',
            label: {
              type: 'plain_text',
              text: '担当者'
            },
            element: {
              type: 'users_select',
              action_id: 'assignee_select',
              placeholder: {
                type: 'plain_text',
                text: '担当者を選択'
              }
            }
          },
          {
            type: 'input',
            block_id: 'due_date',
            optional: true,
            label: {
              type: 'plain_text',
              text: '期限日'
            },
            element: {
              type: 'datepicker',
              action_id: 'date_select',
              placeholder: {
                type: 'plain_text',
                text: '期限日を選択（任意）'
              }
            }
          },
          {
            type: 'input',
            block_id: 'due_time',
            optional: true,
            label: {
              type: 'plain_text',
              text: '期限時刻'
            },
            element: {
              type: 'timepicker',
              action_id: 'time_select',
              placeholder: {
                type: 'plain_text',
                text: '期限時刻を選択（任意）'
              }
            }
          },
          {
            type: 'input',
            block_id: 'channel',
            label: {
              type: 'plain_text',
              text: '通知先チャンネル'
            },
            element: {
              type: 'channels_select',
              action_id: 'channel_select',
              placeholder: {
                type: 'plain_text',
                text: 'チャンネルを選択'
              }
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('モーダル表示エラー:', error);
  }
});
```

### Step 3: モーダル送信ハンドラーの実装

```javascript
// モーダル送信時の処理
app.view('task_modal_submit', async ({ ack, body, view, client }) => {
  await ack();

  try {
    // フォームから値を取得
    const values = view.state.values;

    const taskText = values.task_text.text_input.value;
    const assignee = values.assignee.assignee_select.selected_user;
    const channel = values.channel.channel_select.selected_channel;
    const dueDate = values.due_date.date_select.selected_date; // YYYY-MM-DD
    const dueTime = values.due_time.time_select.selected_time; // HH:MM

    // 期限日時を結合（タイムゾーン考慮）
    let dueDateTimestamp = null;
    if (dueDate) {
      if (dueTime) {
        // 日付と時刻を結合
        dueDateTimestamp = new Date(`${dueDate}T${dueTime}:00+09:00`); // JST
      } else {
        // 日付のみの場合は23:59:59に設定
        dueDateTimestamp = new Date(`${dueDate}T23:59:59+09:00`);
      }
    }

    // タスクをデータベースに作成
    const newTask = await taskService.createTask({
      text: taskText,
      channel: channel,
      messageTs: `manual_${Date.now()}`, // 手動作成の場合は特殊なTS
      createdBy: body.user.id,
      assignee: assignee,
      dueDate: dueDateTimestamp
    });

    // チャンネルに通知
    let notificationText = `✅ タスクを作成しました！\n\n*タスクID:* ${newTask.task_id}\n*内容:* ${taskText}\n*担当:* <@${assignee}>`;

    if (dueDateTimestamp) {
      const dueDateStr = dueDateTimestamp.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Tokyo'
      });
      notificationText += `\n*期限:* ${dueDateStr}`;
    }

    await client.chat.postMessage({
      channel: channel,
      text: notificationText
    });

    console.log(`タスク作成（モーダル経由）: ${newTask.task_id}`);
  } catch (error) {
    console.error('タスク作成エラー（モーダル）:', error);
  }
});
```

### Step 4: 相対日付の追加（オプション）

ユーザーが「明日」「来週」などの相対日付を簡単に選べるように、ラジオボタンを追加:

```javascript
// モーダルのblocksに以下を追加（datepickerの前）
{
  type: 'section',
  block_id: 'quick_deadline',
  text: {
    type: 'mrkdwn',
    text: '*クイック期限設定*'
  },
  accessory: {
    type: 'static_select',
    action_id: 'quick_deadline_select',
    placeholder: {
      type: 'plain_text',
      text: 'クイック設定'
    },
    options: [
      {
        text: { type: 'plain_text', text: '今日' },
        value: 'today'
      },
      {
        text: { type: 'plain_text', text: '明日' },
        value: 'tomorrow'
      },
      {
        text: { type: 'plain_text', text: '3日後' },
        value: '3days'
      },
      {
        text: { type: 'plain_text', text: '1週間後' },
        value: '1week'
      }
    ]
  }
}
```

クイック選択のハンドラー:
```javascript
// クイック期限選択（モーダル内での動的更新）
app.action('quick_deadline_select', async ({ ack }) => {
  await ack();
  // 注: モーダルの動的更新はview.updateを使用
  // 実装は複雑なため、オプションとして後回し推奨
});
```

### Step 5: 動作テスト

1. **Slackでショートカット実行**
   - ⚡アイコン（ショートカット） → "Create Task with Deadline"を選択
   - モーダルが表示される

2. **フォーム入力**
   - タスク内容: 「テストタスク」
   - 担当者: 自分を選択
   - 期限日: 明日
   - 期限時刻: 15:00
   - チャンネル: テストチャンネル

3. **「作成」ボタンをクリック**
   - チャンネルに通知が投稿される
   - データベースに期限付きタスクが保存される

4. **データベース確認**
   ```
   mcp__supabase__execute_sql
   query: "SELECT task_id, text, due_date FROM tasks WHERE due_date IS NOT NULL ORDER BY created_at DESC LIMIT 5;"
   ```

## 📤 成果物

- ✅ グローバルショートカットが動作する
- ✅ モーダルUIでタスク作成できる
- ✅ 期限（日付・時刻）を設定できる
- ✅ 担当者とチャンネルを選択できる
- ✅ 期限付きタスクがデータベースに保存される

## 🔍 確認方法

```bash
# アプリ起動
npm start

# Slackでショートカット実行
⚡ → "Create Task with Deadline"

# データベース確認
node -e "
  const taskService = require('./src/services/taskService');
  (async () => {
    const tasks = await taskService.getTasks({ status: 'open' });
    tasks.forEach(t => {
      console.log(\`\${t.task_id}: 期限=\${t.due_date}\`);
    });
  })();
"
```

## ⚠️ 注意点

1. **タイムゾーンの扱い**
   - Slackのdatepicker/timepickerはユーザーのローカルタイムゾーン
   - データベースには`TIMESTAMP WITH TIME ZONE`で保存
   - 日本時間（JST, +09:00）を明示的に指定

2. **モーダルの応答時間**
   - `ack()`は3秒以内に必ず呼ぶ
   - 重い処理（DB操作）は`ack()`の後に実行

3. **手動作成のmessage_ts**
   - リアクションから作成する場合と異なり、元メッセージがない
   - `manual_${Date.now()}`のような特殊な値を使用

4. **Block Kitの制限**
   - モーダルは最大3000文字まで
   - 複雑なUIは避け、シンプルに保つ

## 🚀 次のステップ

→ [タスク7: リマインダーサービスの実装](./task-07-reminder-service.md)
