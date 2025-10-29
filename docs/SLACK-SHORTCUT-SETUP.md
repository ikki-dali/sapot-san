# Slack グローバルショートカットの設定方法

## 🎯 目的

「Create Task with Deadline」グローバルショートカットをSlackアプリに追加する手順です。

## 📋 設定手順

### Step 1: Slack API ダッシュボードにアクセス

1. https://api.slack.com/apps にアクセス
2. 「サポ田さん」アプリを選択

### Step 2: Interactivity & Shortcuts を開く

1. 左サイドバーから **Features** → **Interactivity & Shortcuts** を選択
2. **Interactivity** が **On** になっていることを確認
   - Socket Modeを使用している場合は自動的にOnになっています

### Step 3: グローバルショートカットを作成

1. **Shortcuts** セクションの **Create New Shortcut** ボタンをクリック
2. **Global Shortcut** を選択
3. 以下の情報を入力：

| フィールド | 値 |
|-----------|-----|
| **Name** | `Create Task with Deadline` |
| **Short Description** | `期限付きタスクを作成` |
| **Callback ID** | `create_task_modal` |

4. **Create** ボタンをクリック

### Step 4: 設定を保存

1. ページ下部の **Save Changes** ボタンをクリック
2. 設定が保存されたことを確認

### Step 5: 動作確認

1. Slackワークスペースに移動
2. ⚡アイコン（ライトニング）をクリック
3. 「Create Task with Deadline」が表示されることを確認
4. クリックするとモーダルが表示される

## 📸 スクリーンショット例

### ショートカット設定画面

```
┌─────────────────────────────────────┐
│ Create a Shortcut                   │
├─────────────────────────────────────┤
│ Name: Create Task with Deadline     │
│                                     │
│ Short Description:                  │
│ 期限付きタスクを作成                 │
│                                     │
│ Callback ID: create_task_modal      │
│                                     │
│         [Cancel]  [Create]          │
└─────────────────────────────────────┘
```

### Slackでの表示

ユーザーが⚡アイコンをクリックすると：

```
⚡ Shortcuts
├─ Browse shortcuts
├─ Create Task with Deadline  ← これが追加される
└─ ...
```

## ✅ 確認ポイント

- [ ] Interactivity & Shortcuts で Interactivity が On になっている
- [ ] Global Shortcut が作成されている
- [ ] Callback ID が `create_task_modal` になっている
- [ ] Slackの⚡アイコンから「Create Task with Deadline」が選択できる
- [ ] ショートカットをクリックするとモーダルが表示される

## 🔧 トラブルシューティング

### ショートカットが表示されない

**原因**: アプリが再インストールされていない可能性

**解決方法**:
1. Slack API ダッシュボード → **Settings** → **Install App**
2. **Reinstall to Workspace** をクリック
3. 権限を確認して承認

### モーダルが表示されない

**原因**: アプリが起動していない、またはCallback IDの不一致

**解決方法**:
1. ターミナルで `npm start` を実行してアプリが起動していることを確認
2. `app.js` の `app.shortcut('create_task_modal')` のCallback IDを確認
3. エラーログを確認: `console.error('モーダル表示エラー:')`

### "This app didn't respond in time" エラー

**原因**: `ack()` が3秒以内に呼ばれていない

**解決方法**:
- `app.js` のショートカットハンドラーで `await ack();` が最初に呼ばれていることを確認

## 📚 参考リンク

- [Slack API: Shortcuts](https://api.slack.com/interactivity/shortcuts)
- [Slack API: Global Shortcuts](https://api.slack.com/interactivity/shortcuts/using#global_shortcuts)
- [Slack Bolt: Shortcuts](https://slack.dev/bolt-js/concepts#shortcuts)

---

**設定が完了したら、Task 6の実装は完了です！**
