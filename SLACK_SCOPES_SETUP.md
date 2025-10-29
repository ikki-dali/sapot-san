# Slack App Scopes 設定ガイド

## 📋 概要

シンプルAIアシスタント機能を実装するために、Slack Appに以下のscopesを追加する必要があります。

## 🔑 必要なScopes

### Bot Token Scopes（既存 + 追加）

Slack App管理画面（https://api.slack.com/apps）で設定します：

**OAuth & Permissions > Scopes > Bot Token Scopes**

#### 既存のScopes（現在動作しているもの）
- `app_mentions:read` - @メンションを読む
- `channels:history` - パブリックチャンネルの履歴を読む ✅
- `channels:read` - パブリックチャンネル情報を読む
- `chat:write` - メッセージを投稿
- `commands` - スラッシュコマンドを実行
- `reactions:read` - リアクションを読む
- `reactions:write` - リアクションを追加
- `users:read` - ユーザー情報を読む

#### 🆕 追加が必要なScopes（情報検索機能用）

```yaml
# パブリックチャンネルの履歴を読む（既に追加済みの可能性大）
channels:history

# プライベートチャンネルの履歴を読む（ボットが参加している場合のみ）
groups:history

# ダイレクトメッセージの履歴を読む
im:history

# グループDMの履歴を読む
mpim:history

# チャンネル情報を読む（既に追加済みの可能性大）
channels:read
groups:read

# メンバー情報を取得
users:read
users:read.email  # オプション: メールアドレスも取得する場合
```

#### 🔍 検索機能を強化する場合（オプション）

```yaml
# Slack検索APIを使う場合
search:read
```

### User Token Scopes（現状は不要）

Bot Token Scopesのみで十分です。User Token Scopesは使いません。

## 📝 設定手順

### 1. Slack App管理画面にアクセス

1. https://api.slack.com/apps にアクセス
2. 「サポ田さん」アプリを選択

### 2. Scopesを追加

1. 左サイドバーから **OAuth & Permissions** を選択
2. **Scopes** セクションまでスクロール
3. **Bot Token Scopes** で以下を追加:

**最低限必要なScopes:**
```
✅ channels:history  (既存の可能性大)
✅ groups:history    (追加)
✅ im:history        (追加)
✅ mpim:history      (追加)
```

**推奨Scopes（既存のはず）:**
```
✅ channels:read
✅ groups:read
✅ users:read
```

### 3. ワークスペースに再インストール

Scopesを追加した後、以下の手順で再インストールが必要です：

1. **OAuth & Permissions** ページの上部にある警告バナーを確認
2. **"reinstall your app"** リンクをクリック
3. 権限を確認して **"Allow"** をクリック
4. 新しい **Bot User OAuth Token** が発行される（以前のトークンは無効化）

### 4. .envファイルを更新（必要な場合）

新しいトークンが発行された場合：

```bash
# 新しいトークンをコピー
SLACK_BOT_TOKEN=xoxb-新しいトークン
```

**注意**: Renderなど本番環境の環境変数も更新してください。

### 5. 動作確認

```bash
# ローカルでサーバーを再起動
npm start

# または本番環境でデプロイ
git push origin main
```

## 🔐 セキュリティ考慮事項

### 追加scopesの影響

| Scope | 権限 | リスク | 対策 |
|-------|------|--------|------|
| `channels:history` | パブリックチャンネルの履歴閲覧 | 低 | ユーザーがアクセスできる情報のみ検索 |
| `groups:history` | プライベートチャンネルの履歴閲覧 | 中 | ボットが参加しているチャンネルのみ |
| `im:history` | DM履歴の閲覧 | 高 | ⚠️ 慎重に扱う |
| `mpim:history` | グループDM履歴の閲覧 | 高 | ⚠️ 慎重に扱う |

### 実装での対策

```javascript
// ❌ NG: 全チャンネルを無制限に検索
async function searchAllChannels(keyword) {
  const allChannels = await client.conversations.list();
  // すべてのチャンネルを検索...
}

// ✅ OK: ユーザーがアクセス可能なチャンネルのみ検索
async function searchUserAccessibleChannels(userId, keyword) {
  // ユーザーが参加しているチャンネルのみを取得
  const userChannels = await client.users.conversations({ user: userId });
  // そのチャンネル内でのみ検索...
}
```

## 🧪 テスト方法

Scopesが正しく追加されたか確認するコマンド：

```bash
# Slack APIで権限をテスト
curl -H "Authorization: Bearer xoxb-YOUR-TOKEN" \
  "https://slack.com/api/auth.test"
```

成功すると、`ok: true`が返されます。

## 📚 参考リンク

- [Slack API Scopes](https://api.slack.com/scopes)
- [conversations.history](https://api.slack.com/methods/conversations.history)
- [OAuth & Permissions](https://api.slack.com/authentication/oauth-v2)

## ❓ FAQ

### Q: Scopesを追加するとユーザーに通知される？

A: はい。ワークスペース管理者と、プライベートチャンネルのメンバーに通知が届きます。

### Q: 既存のトークンは使える？

A: いいえ。Scopesを追加した後は再インストールが必要で、新しいトークンが発行されます。

### Q: DMの履歴も検索される？

A: `im:history`を追加すると技術的には可能ですが、実装でフィルタリングします。通常はパブリック/プライベートチャンネルのみ検索対象にします。

### Q: 最小限のScopesで始めたい

A: まずは`channels:history`と`groups:history`のみ追加し、パブリック/プライベートチャンネルの検索から始めることをおすすめします。DMは後から追加できます。

---

**作成日**: 2025-10-29
**更新日**: 2025-10-29
