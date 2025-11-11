# 「アクセスをブロック: sapota-san は組織内でのみ利用可能です」エラーの解決方法

## 🔍 問題の原因

このエラーは、Google Cloud ConsoleのOAuth同意画面が **Internal（組織内のみ）** に設定されているために発生します。

Internal設定の場合、Google Workspaceの組織内のユーザーしかアクセスできません。

## ✅ 解決方法（2つの選択肢）

### 方法1: External（外部）に変更（推奨）

個人のGoogleアカウントでも使用できるようになります。

#### 手順:

1. **Google Cloud Console** にアクセス
   - https://console.cloud.google.com/

2. プロジェクトを選択
   - 左上のプロジェクト名をクリック → `sapota-san` を選択

3. **APIs & Services** → **OAuth consent screen** に移動
   - 左メニュー → 「APIとサービス」→「OAuth同意画面」

4. **User Type** を変更
   - 現在: `Internal` ← これが原因
   - 変更: `External` に変更

   **「MAKE EXTERNAL」ボタンをクリック**

5. Publishing status を設定
   - **Testing** を選択（本番公開しない場合）
   - テストユーザーに自分のGmailアドレスを追加

6. 確認
   - OAuth同意画面が以下のように表示されることを確認：
     ```
     Publishing status: Testing
     User type: External
     ```

#### Publishing status の説明:

- **Testing**: テストユーザー（最大100人）のみアクセス可能。本番公開前の開発・テスト用。
- **In production**: 誰でもアクセス可能。Google の審査が必要（機密スコープを使用する場合）。

### 方法2: テストユーザーを追加（Internal のまま）

Google Workspaceを使用している場合で、組織内のユーザーのみが使う場合。

#### 手順:

1. **Google Cloud Console** → **APIs & Services** → **OAuth consent screen**

2. **Test users** セクションで **ADD USERS** をクリック

3. 使用するGoogleアカウントのメールアドレスを追加
   - 例: `your-email@gmail.com`
   - 複数のアカウントを追加可能（最大100個）

4. **SAVE** をクリック

## 🎯 推奨設定（開発環境）

開発・テスト環境では以下の設定がおすすめです：

```
User type: External
Publishing status: Testing
Test users: your-email@gmail.com（自分のメールアドレス）
```

この設定なら：
- ✅ 個人のGoogleアカウントで使用可能
- ✅ Google Workspaceの組織がなくても動作
- ✅ 審査不要
- ✅ 最大100人のテストユーザーを追加可能

## 📋 設定後の確認手順

1. **ブラウザのキャッシュをクリア**
   - Chrome: `Cmd + Shift + Delete`（Mac）/ `Ctrl + Shift + Delete`（Windows）
   - 「Cookieと他のサイトデータ」を削除

2. **再度OAuth認証を試す**
   ```bash
   open "http://localhost:3000/api/google-calendar/auth?slack_user_id=U09CAH6FZPW"
   ```

3. **Googleの認証画面が表示される**
   - "This app isn't verified" という警告が表示される場合があります
   - これは正常です（テスト中のアプリのため）
   - **「Advanced」** → **「Go to sapota-san (unsafe)」** をクリック

4. **カレンダーへのアクセスを許可**
   - 「Allow」をクリック

5. **成功！**
   - 「認証完了！」ページが表示されます

## ⚠️ トラブルシューティング

### "This app isn't verified" という警告が表示される

これは正常です。以下の手順で進めてください：

1. **「Advanced」** をクリック
2. **「Go to sapota-san (unsafe)」** をクリック
3. アクセス許可画面で **「Allow」** をクリック

この警告は、アプリがGoogleの審査を受けていないために表示されます。個人開発や社内利用の場合は問題ありません。

### まだ「アクセスをブロック」が表示される

以下を確認してください：

1. **OAuth同意画面の設定が反映されているか確認**
   - Google Cloud Console → OAuth consent screen
   - User type が `External` になっているか
   - Publishing status が `Testing` になっているか

2. **ブラウザのキャッシュ・Cookieを削除**
   - Googleの認証情報がキャッシュされている可能性

3. **別のブラウザ/シークレットモードで試す**
   ```bash
   # Chrome シークレットモード
   open -a "Google Chrome" --args --incognito "http://localhost:3000/api/google-calendar/auth?slack_user_id=U09CAH6FZPW"
   ```

4. **使用しているGoogleアカウントを確認**
   - Internalの場合: Google Workspaceのアカウントが必要
   - Externalの場合: 任意のGoogleアカウントでOK

## 🎨 本番環境での設定

本番環境に公開する場合（誰でも使えるようにする場合）：

1. **OAuth同意画面** → **PUBLISH APP** をクリック

2. **機密スコープを使用する場合**
   - Googleの審査が必要
   - 審査には数週間かかる場合があります
   - 参考: https://support.google.com/cloud/answer/9110914

3. **機密スコープを使用しない場合**
   - 審査不要で即座に公開可能
   - 現在使用しているスコープ:
     - `https://www.googleapis.com/auth/calendar`（機密）
     - `https://www.googleapis.com/auth/calendar.events`（機密）

**注意**: カレンダーAPIは機密スコープなので、本番公開にはGoogleの審査が必要です。

## 📝 まとめ

| 設定 | 対象ユーザー | 審査 | 推奨用途 |
|------|-------------|------|----------|
| Internal | 組織内のみ | 不要 | 社内専用アプリ |
| External + Testing | テストユーザーのみ | 不要 | **開発・テスト** ← 今回推奨 |
| External + In production | 誰でも | 必要 | 一般公開アプリ |

**今回の推奨設定**: `External + Testing` でテストユーザーに自分のメールアドレスを追加

これで、個人のGoogleアカウントでもカレンダー連携が使えるようになります！
