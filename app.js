require('dotenv').config();
const { App } = require('@slack/bolt');
const { checkConnection, supabase } = require('./src/db/connection');
const taskService = require('./src/services/taskService');
const reminderService = require('./src/services/reminderService');
const userReminderService = require('./src/services/userReminderService');
const aiService = require('./src/services/aiService');
const unrepliedService = require('./src/services/unrepliedService');
const logger = require('./src/utils/logger');
const { handleError } = require('./src/utils/errorHandler');

// ===============================
// グローバルエラーハンドラー
// ===============================
// 未処理の例外をキャッチ
process.on('uncaughtException', (error) => {
  logger.error('未処理の例外が発生しました', {
    error: error.message,
    stack: error.stack
  });

  // グレースフルシャットダウン
  process.exit(1);
});

// 未処理のPromise拒否をキャッチ
process.on('unhandledRejection', (reason, promise) => {
  logger.error('未処理のPromise拒否が発生しました', {
    reason: reason
  });

  // グレースフルシャットダウン
  process.exit(1);
});

// SIGTERMシグナル（本番環境での正常終了）
process.on('SIGTERM', () => {
  logger.info('SIGTERMシグナルを受信しました。グレースフルシャットダウンを開始します。');

  // Slackアプリを停止
  if (app) {
    app.stop().then(() => {
      logger.info('サポ田さんを正常に停止しました');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Slackアプリの初期化
// 学習ポイント: Boltアプリは、token（認証）とsigningSecret（署名検証）が必要
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true, // ソケットモード（開発時に便利、ポート開放不要）
  appToken: process.env.SLACK_APP_TOKEN,
});

// タスク管理はtaskServiceを使用（データベース永続化）

// ===============================
// ヘルパー関数: 優先度の絵文字と表示
// ===============================
// AI機能が有効かチェック
const isAIEnabled = process.env.AI_ENABLED === 'true';

/**
 * 優先度に応じた絵文字を返す
 * @param {number} priority - 優先度 (1=高, 2=中, 3=低)
 * @returns {string} 絵文字
 */
function getPriorityEmoji(priority) {
  const emojis = {
    1: '🔴', // 高
    2: '🟡', // 中
    3: '🟢'  // 低
  };
  return emojis[priority] || '⚪';
}

/**
 * 優先度に応じたラベルを返す
 * @param {number} priority - 優先度 (1=高, 2=中, 3=低)
 * @returns {string} ラベル
 */
function getPriorityLabel(priority) {
  const labels = {
    1: '高',
    2: '中',
    3: '低'
  };
  return labels[priority] || '中';
}

// ===============================
// 1. リアクションでタスク作成
// ===============================
// 学習ポイント: reaction_addedイベントは、誰かがメッセージにリアクションした時に発火
app.event('reaction_added', async ({ event, client }) => {
  try {
    // 特定の絵文字（例：✅ :white_check_mark:）でタスク化
    if (event.reaction === 'white_check_mark' || event.reaction === 'memo') {
      // メッセージの内容を取得
      const result = await client.conversations.history({
        channel: event.item.channel,
        latest: event.item.ts,
        limit: 1,
        inclusive: true
      });

      const message = result.messages[0];

      // AI機能: スレッドがあれば要約、優先度判定
      let summary = null;
      let priority = 2; // デフォルト: 中優先度

      if (isAIEnabled) {
        try {
          // スレッドのメッセージを取得
          const threadMessages = await aiService.fetchThreadMessages(
            client,
            event.item.channel,
            event.item.ts
          );

          // スレッドが複数メッセージある場合は要約
          if (threadMessages.length > 1 && process.env.AI_SUMMARIZE_ENABLED === 'true') {
            logger.ai(`スレッド要約を開始（${threadMessages.length}件のメッセージ）`);
            summary = await aiService.summarizeThread(threadMessages);
          }

          // 優先度を判定
          if (process.env.AI_PRIORITY_ENABLED === 'true') {
            logger.ai('優先度判定を開始');
            priority = await aiService.determinePriority(message.text);
          }
        } catch (aiError) {
          logger.warn('AI処理エラー（タスク作成は続行）', { error: aiError.message });
        }
      }

      // タスクをデータベースに保存
      const newTask = await taskService.createTask({
        text: message.text,
        channel: event.item.channel,
        messageTs: event.item.ts,
        createdBy: event.user,
        assignee: message.user, // メッセージの送信者を担当者に
        priority: priority,
        summary: summary
      });

      // タスク作成を通知
      let notificationText = `✅ タスクを作成しました！\n\n*タスクID:* ${newTask.task_id}\n*内容:* ${message.text}\n*担当:* <@${message.user}>\n*優先度:* ${getPriorityEmoji(priority)} ${getPriorityLabel(priority)}`;

      if (summary) {
        notificationText += `\n\n*📝 要約:*\n${summary}`;
      }

      await client.chat.postMessage({
        channel: event.item.channel,
        thread_ts: event.item.ts, // スレッドで返信
        text: notificationText
      });

      logger.task(`タスク作成: ${newTask.task_id} (優先度: ${getPriorityLabel(priority)})`);
    }
  } catch (error) {
    logger.failure('タスク作成エラー', { error: error.message, stack: error.stack });

    // エラーをユーザーに通知
    try {
      await client.chat.postMessage({
        channel: event.item.channel,
        thread_ts: event.item.ts,
        text: `❌ タスク作成に失敗しました: ${error.message}`
      });
    } catch (notifyError) {
      logger.error('エラー通知失敗', { error: notifyError.message });
    }
  }
});

// ===============================
// 2. タスク一覧を表示するコマンド
// ===============================
// 学習ポイント: スラッシュコマンド（/task-list など）を定義
app.command('/task-list', async ({ command, ack, client }) => {
  await ack(); // Slackにコマンドを受け取ったことを即座に通知（3秒以内必須）

  try {
    // 現在のタスクを取得（デフォルトで未完了のみ）
    const userTasks = await taskService.getTasks({ status: 'open' });

    if (userTasks.length === 0) {
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: '現在、未完了のタスクはありません！'
      });
      return;
    }

    // 優先度順にソート（1=高, 2=中, 3=低）
    const sortedTasks = userTasks.sort((a, b) => {
      const priorityA = a.priority || 2;
      const priorityB = b.priority || 2;
      return priorityA - priorityB; // 1 → 2 → 3 の順
    });

    // Block Kitでタスクリストを作成（ボタン付き）
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📋 現在のタスク一覧'
        }
      },
      {
        type: 'divider'
      }
    ];

    sortedTasks.forEach(task => {
      const createdDate = new Date(task.created_at).toLocaleDateString('ja-JP');
      const taskPriority = task.priority || 2;

      let taskText = `${getPriorityEmoji(taskPriority)} *${task.text}*\n`;
      taskText += `担当: <@${task.assignee}> | 作成日: ${createdDate} | 優先度: ${getPriorityLabel(taskPriority)}`;

      // 期限がある場合は表示
      if (task.due_date) {
        const dueDate = new Date(task.due_date).toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Tokyo'
        });
        taskText += `\n期限: ${dueDate}`;
      }

      // 要約がある場合は表示
      if (task.summary) {
        const truncatedSummary = task.summary.length > 100
          ? task.summary.substring(0, 100) + '...'
          : task.summary;
        taskText += `\n\n_📝 要約: ${truncatedSummary}_`;
      }

      // 各タスクをsectionブロックにして、完了ボタンを付ける
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: taskText
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '✅ 完了'
          },
          style: 'primary',
          action_id: `complete_task_${task.task_id}`,
          value: task.task_id
        }
      });

      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `タスクID: \`${task.task_id}\``
          }
        ]
      });

      blocks.push({
        type: 'divider'
      });
    });

    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: '📋 現在のタスク一覧',
      blocks: blocks
    });
  } catch (error) {
    console.error('タスク一覧表示エラー:', error);
  }
});

// ===============================
// 3. タスク完了コマンド
// ===============================
app.command('/task-done', async ({ command, ack, client }) => {
  await ack();

  try {
    const taskId = command.text.trim();

    // タスクの存在確認
    const task = await taskService.getTaskById(taskId);

    if (!task) {
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: `❌ タスクID「${taskId}」が見つかりません`
      });
      return;
    }

    // タスクを完了状態に
    await taskService.completeTask(taskId, command.user_id);

    // 元のスレッドに完了通知
    await client.chat.postMessage({
      channel: task.channel,
      thread_ts: task.message_ts,
      text: `🎉 タスクが完了しました！\n*完了者:* <@${command.user_id}>`
    });
  } catch (error) {
    console.error('タスク完了エラー:', error);
  }
});

// ===============================
// 4. タスク完了ボタンのアクション
// ===============================
// 学習ポイント: ボタンクリック時の処理
app.action(/^complete_task_/, async ({ action, ack, body, client }) => {
  await ack();

  try {
    const taskId = action.value;

    // タスクの存在確認
    const task = await taskService.getTaskById(taskId);

    if (!task) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: body.user.id,
        text: `❌ タスクID「${taskId}」が見つかりません`
      });
      return;
    }

    // タスクを完了状態に
    await taskService.completeTask(taskId, body.user.id);

    // 元のスレッドに完了通知（手動作成タスク以外）
    if (task.message_ts && !task.message_ts.startsWith('manual_')) {
      await client.chat.postMessage({
        channel: task.channel,
        thread_ts: task.message_ts,
        text: `🎉 タスクが完了しました！\n*完了者:* <@${body.user.id}>`
      });
    }

    // ボタンを押したユーザーに確認メッセージ
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: body.user.id,
      text: `✅ タスク「${task.text}」を完了しました`
    });

    console.log(`タスク完了（ボタン経由）: ${taskId}`);
  } catch (error) {
    console.error('タスク完了エラー（ボタン）:', error);
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: body.user.id,
      text: `❌ タスクの完了処理に失敗しました: ${error.message}`
    });
  }
});

// ===============================
// 5. リマインダーテストコマンド（管理者用）
// ===============================
app.command('/remind-sapota', async ({ command, ack, client }) => {
  await ack();

  try {
    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: '⏰ リマインダーチェックを手動実行します...'
    });

    // 24時間以内の期限タスクをチェック
    await reminderService.checkUpcomingDeadlines(client, 24);

    // 期限切れタスクをチェック
    await reminderService.checkOverdueTasks(client);

    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: '✅ リマインダーチェック完了'
    });
  } catch (error) {
    console.error('リマインダーテストエラー:', error);
    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: `❌ エラー: ${error.message}`
    });
  }
});

// ===============================
// 6. メンションを検知（AI自動タスク化）
// ===============================
app.event('app_mention', async ({ event, client }) => {
  try {
    // メッセージからメンション部分を削除してクリーンなテキストを取得
    const cleanText = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();

    console.log('🤖 サポ田さんメンション受信:', cleanText);

    // AI機能が有効な場合は意図判定を実行
    if (!isAIEnabled) {
      // AI無効の場合はヘルプを表示
      await showHelpMessage(client, event);
      return;
    }

    // ========================================
    // Step 1: 意図判定
    // ========================================
    const intentService = require('./src/services/intentService');
    const intentResult = await intentService.detectIntent(cleanText);

    console.log(`🔍 意図判定結果: ${intentResult.intent} (確信度: ${intentResult.confidence}%)`);
    console.log(`   理由: ${intentResult.reason}`);

    // ========================================
    // Step 2: 意図に応じて処理を分岐
    // ========================================

    // 2-1. タスク依頼
    if (intentResult.intent === intentService.INTENTS.TASK_REQUEST) {
      await handleTaskRequest(client, event, cleanText, intentResult);
      return;
    }

    // 2-2. 情報検索
    if (intentResult.intent === intentService.INTENTS.INFORMATION) {
      await handleInformationRequest(client, event, cleanText, intentResult);
      return;
    }

    // 2-3. リマインド設定
    if (intentResult.intent === intentService.INTENTS.REMINDER_SETUP) {
      await handleReminderRequest(client, event, cleanText, intentResult);
      return;
    }

    // 2-4. リマインドキャンセル
    if (intentResult.intent === intentService.INTENTS.REMINDER_CANCEL) {
      await handleReminderCancelRequest(client, event, cleanText, intentResult);
      return;
    }

    // 2-5. ヘルプ / その他
    await showHelpMessage(client, event);

  } catch (error) {
    console.error('❌ メンション応答エラー:', error);
    console.error('スタックトレース:', error.stack);

    // エラー時はユーザーに通知
    try {
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: `❌ エラーが発生しました: ${error.message}\n\n手動でタスクを作成するには、✅ や :memo: のリアクションをつけてください。`
      });
    } catch (notifyError) {
      console.error('エラー通知失敗:', notifyError);
    }
  }
});

// ========================================
// ヘルパー関数: タスク依頼処理
// ========================================
async function handleTaskRequest(client, event, cleanText, intentResult) {
  console.log('📋 タスク依頼を処理中...');

  if (!intentService.isConfident(intentResult, 70)) {
    console.log(`⚠️  確信度が低いため、確認メッセージを表示します (${intentResult.confidence}%)`);
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.ts,
      text: `🤔 タスクとして記録しますか？\n\n内容: "${cleanText}"\n\n記録する場合は、このメッセージに ✅ をつけてください。`
    });
    return;
  }

  // 絵文字から優先度を検出（🔴=高, 🟡=中, 🟢=低）
  let userPriority = null;
  if (cleanText.includes('🔴')) {
    userPriority = 1; // 高
    console.log('👤 ユーザーが優先度を指定: 🔴 高');
  } else if (cleanText.includes('🟡')) {
    userPriority = 2; // 中
    console.log('👤 ユーザーが優先度を指定: 🟡 中');
  } else if (cleanText.includes('🟢')) {
    userPriority = 3; // 低
    console.log('👤 ユーザーが優先度を指定: 🟢 低');
  }

  // タスク情報を抽出
  const taskInfo = await aiService.extractTaskInfo(cleanText);

  // ユーザーが絵文字で指定した優先度を優先、なければAI判定を使用
  const finalPriority = userPriority !== null ? userPriority : taskInfo.priority;

  // タスクをデータベースに作成
  const newTask = await taskService.createTask({
    text: taskInfo.title,
    channel: event.channel,
    messageTs: event.ts,
    createdBy: event.user,
    assignee: event.user,
    dueDate: taskInfo.dueDate ? new Date(taskInfo.dueDate) : null,
    priority: finalPriority
  });

  // タスク作成完了を通知
  let notificationText = `✅ タスクを作成しました！\n\n*タスクID:* ${newTask.task_id}\n*内容:* ${taskInfo.title}\n*担当:* <@${event.user}>\n*優先度:* ${getPriorityEmoji(finalPriority)} ${getPriorityLabel(finalPriority)}`;

  if (taskInfo.dueDate) {
    const dueDateStr = new Date(taskInfo.dueDate).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    });
    notificationText += `\n*期限:* ${dueDateStr}`;
  }

  notificationText += `\n\n💡 ${intentResult.reason}`;

  await client.chat.postMessage({
    channel: event.channel,
    thread_ts: event.ts,
    text: notificationText
  });

  logger.task(`タスク作成: ${newTask.task_id} (意図判定)`);
}

// ========================================
// ヘルパー関数: 情報検索処理
// ========================================
async function handleInformationRequest(client, event, cleanText, intentResult) {
  console.log('🔍 情報検索を処理中...');

  try {
    // ステップ1: 質問の種類を判定（一般的な質問 vs Slack固有の質問）
    const needsSlackSearch = await determineIfSlackSearchNeeded(cleanText);

    if (needsSlackSearch) {
      // Slack固有の質問 → 履歴検索を実行
      console.log('📚 Slack履歴検索が必要と判断');

      // 検索中メッセージを表示
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: `🔍 Slack履歴を検索中です...\n\n「${cleanText}」に関する過去の会話を探しています。`
      });

      const searchService = require('./src/services/searchService');

      // Slack履歴を検索
      const searchResults = await searchService.searchAcrossChannels(
        event.user,
        cleanText,
        {
          maxChannels: 10,
          maxMessages: 50,
          daysBack: 30
        }
      );

      console.log(`📊 検索結果: ${searchResults.length}件`);

      // AI回答を生成
      const answerResult = await aiService.generateAnswerFromSearch(cleanText, searchResults);

      // 回答を整形
      let responseText = `📚 **回答**\n\n${answerResult.answer}\n\n`;

      if (answerResult.sources && answerResult.sources.length > 0) {
        responseText += `📍 **出典**\n`;
        answerResult.sources.slice(0, 3).forEach((source, index) => {
          responseText += `${index + 1}. #${source.channel} (${source.date})\n`;
        });
        responseText += `\n_確信度: ${answerResult.confidence}%_`;
      }

      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: responseText
      });

      logger.info(`Slack履歴検索成功: "${cleanText}" (結果: ${searchResults.length}件)`);
    } else {
      // 一般的な質問 → AIが直接回答
      console.log('🤖 AIが直接回答');

      // 考え中メッセージを表示
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: `💭 考え中です...\n\n「${cleanText}」`
      });

      // スレッドの会話履歴を取得（コンテキストとして使用）
      let threadMessages = [];
      try {
        const threadTs = event.thread_ts || event.ts;
        threadMessages = await aiService.fetchThreadMessages(client, event.channel, threadTs);
        console.log(`📚 スレッド履歴取得: ${threadMessages.length}件のメッセージ`);
      } catch (error) {
        console.warn('⚠️  スレッド履歴取得失敗（履歴なしで回答）:', error.message);
      }

      // AIに直接質問（スレッドコンテキスト付き）
      const answer = await aiService.answerDirectQuestion(cleanText, threadMessages);

      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: `💡 **回答**\n\n${answer}`
      });

      logger.info(`AI直接回答成功: "${cleanText}" (コンテキスト: ${threadMessages.length}件)`);
    }
  } catch (error) {
    console.error('❌ 情報検索エラー:', error);
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.ts,
      text: `❌ エラーが発生しました。\n\nしばらくしてから再度お試しください。`
    });
  }
}

/**
 * Slack履歴検索が必要かを判定
 * @param {string} question - ユーザーの質問
 * @returns {Promise<boolean>} true: Slack検索必要, false: AI直接回答
 */
async function determineIfSlackSearchNeeded(question) {
  // Slack固有のキーワードパターン（過去の会話を参照する表現）
  const slackRelatedPatterns = [
    // 過去の会話を参照
    /(誰|だれ)(が|に|は).*(言|い|話|依頼|頼|聞|教|伝|送|返)/i,
    /(いつ|何時).*(言|い|話|依頼|頼|聞|教|伝|送|返|決)/i,
    /(前|先週|昨日|最近|さっき|今日|この間).*(言|い|話|依頼|頼|聞|教|伝|送|返|決)/i,

    // 過去の情報を求める
    /(何を|なにを).*(依頼|頼|お願い|任せ|指示)/i,
    /(どこ|どの).*(チャンネル|スレッド|会話)/i,

    // 進捗・状況確認
    /(進捗|状況|ステータス).*(は|どう|教えて)/i,
    /(決まった|きまった).*(こと|内容)/i,

    // 明示的なSlack参照
    /(slack|スラック|履歴|会話|メッセージ|やりとり)/i,
    /(チャンネル|スレッド)/i
  ];

  // いずれかのパターンにマッチすればSlack検索必要
  for (const pattern of slackRelatedPatterns) {
    if (pattern.test(question)) {
      console.log(`🔍 Slack検索パターンにマッチ: ${pattern}`);
      return true;
    }
  }

  // マッチしなければAI直接回答
  console.log('💡 一般的な質問と判定（AI直接回答）');
  return false;
}

// ========================================
// ヘルパー関数: リマインド要求の処理
// ========================================
async function handleReminderRequest(client, event, cleanText, intentResult) {
  console.log('🔔 リマインド要求を処理中...');

  try {
    // 自然言語からリマインド情報をパース
    const parsedReminder = await aiService.parseReminderRequest(cleanText, event.user);

    // 確信度が低い場合は確認
    if (parsedReminder.confidence < 70) {
      console.log(`⚠️  確信度が低いため、確認メッセージを表示します (${parsedReminder.confidence}%)`);
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: `🤔 以下の内容でリマインドを設定しますか？\n\n*メッセージ:* ${parsedReminder.reminderMessage}\n*対象:* <@${parsedReminder.targetUserId}>\n\nよろしければ、このメッセージに ✅ をつけてください。`
      });
      return;
    }

    // リマインドを作成
    const reminder = await userReminderService.createReminder({
      reminderType: parsedReminder.reminderType,
      targetUser: parsedReminder.targetUserId,
      createdBy: event.user,
      message: parsedReminder.reminderMessage,
      channel: event.channel,
      threadTs: event.ts,
      scheduleType: parsedReminder.scheduleType,
      scheduleTime: parsedReminder.scheduleTime,
      intervalMinutes: parsedReminder.intervalMinutes,
      relativeMinutes: parsedReminder.relativeMinutes
    });

    // 次回リマインド時刻を整形
    const nextReminderTime = new Date(reminder.next_reminder_at).toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    });

    // 確認メッセージを送信
    const typeLabel = reminder.reminder_type === 'once' ? '1回のみ' : '定期';
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.ts,
      text: `✅ リマインドを設定しました！\n\n*ID:* ${reminder.id}\n*タイプ:* ${typeLabel}\n*メッセージ:* ${reminder.message}\n*対象:* <@${reminder.target_user}>\n*次回実行:* ${nextReminderTime}\n\nキャンセルする場合は「@サポ田さん リマインドキャンセル ${reminder.id}」と入力してください。`
    });

    console.log(`✅ リマインド設定完了: ID=${reminder.id}`);
  } catch (error) {
    console.error('❌ リマインド設定エラー:', error);
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.ts,
      text: `❌ リマインドの設定に失敗しました。\n\nエラー: ${error.message}\n\n例:\n- 「30分後にリマインドして」\n- 「明日15時にミーティングをリマインド」\n- 「毎日10時にスタンドアップをリマインド」`
    });
  }
}

// ========================================
// ヘルパー関数: リマインドキャンセル処理
// ========================================
async function handleReminderCancelRequest(client, event, cleanText, intentResult) {
  console.log('🚫 リマインドキャンセル要求を処理中...');

  try {
    // テキストから数字（ID）を抽出
    const idMatch = cleanText.match(/\d+/);
    
    let reminderId = null;
    let reminder = null;

    if (idMatch) {
      // IDが指定されている場合
      reminderId = parseInt(idMatch[0]);
      reminder = await userReminderService.getReminder(reminderId);
      
      if (!reminder) {
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.ts,
          text: `❌ ID=${reminderId} のリマインドが見つかりません。\n\n\`/task-list\` でアクティブなリマインドを確認してください。`
        });
        return;
      }
    } else {
      // IDが指定されていない場合、スレッド内を検索
      console.log('📍 スレッド内のリマインダーを検索中...');
      // スレッド内の返信の場合はevent.thread_tsを、親メッセージの場合はevent.tsを使う
      const threadTs = event.thread_ts || event.ts;
      console.log(`🔍 検索対象threadTs: ${threadTs}`);
      reminder = await userReminderService.getReminderByThread(threadTs, event.user);
      
      if (!reminder) {
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.ts,
          text: `⚠️  このスレッド内にアクティブなリマインドが見つかりません。\n\nID を指定してキャンセルする場合：\n\`@サポ田さん リマインドキャンセル [ID]\``
        });
        return;
      }
      reminderId = reminder.id;
    }

    // キャンセルを実行
    const success = await userReminderService.cancelReminder(reminderId, event.user);

    if (success) {
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: `✅ リマインドID=${reminderId}をキャンセルしました。\n\n*メッセージ:* ${reminder.message}`
      });
      console.log(`✅ リマインドキャンセル完了: ID=${reminderId}`);
    } else {
      throw new Error('キャンセルに失敗しました');
    }
  } catch (error) {
    console.error('❌ リマインドキャンセルエラー:', error);
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.ts,
      text: `❌ リマインドのキャンセルに失敗しました。\n\nエラー: ${error.message}`
    });
  }
}

// ========================================
// ヘルパー関数: ヘルプメッセージ表示
// ========================================
async function showHelpMessage(client, event) {
  await client.chat.postMessage({
    channel: event.channel,
    thread_ts: event.ts,
    text: `こんにちは！サポ田さんです 👋\n\n私にできること:\n\n📋 *タスク管理*\n• ✅ や :memo: のリアクションでタスク作成\n• \`/task-list\` でタスク一覧表示\n• \`/task-done [ID]\` でタスク完了\n• 「〇〇をお願いします」でタスク自動作成\n\n🔍 *情報検索*\n• 「先週の会議で決まったことは？」のような質問\n• 過去の会話履歴から情報を探して回答\n\n🔔 *リマインド* (開発中)\n• 「15時にリマインドして」でリマインド設定\n\n💡 質問や依頼があれば、@サポ田さん でメンションしてください！`
  });
}

// ===============================
// 6-2. 全メッセージ監視（メンション検知 + スレッド返信検知）
// ===============================

// レート制限対策: 処理中のメッセージを追跡
const processingMessages = new Set();

app.event('message', async ({ event, client }) => {
  try {
    // 重複処理を防ぐ（同じメッセージが複数回来る場合がある）
    const messageKey = `${event.channel}_${event.ts}`;
    if (processingMessages.has(messageKey)) {
      console.log('⏭️  既に処理中のメッセージをスキップ:', messageKey);
      return;
    }

    processingMessages.add(messageKey);

    // 5秒後に処理完了フラグをクリア
    setTimeout(() => {
      processingMessages.delete(messageKey);
    }, 5000);

    // デバッグログ：すべてのメッセージを記録
    console.log('📨 メッセージ受信:', {
      text: event.text?.substring(0, 50),
      bot_id: event.bot_id,
      subtype: event.subtype,
      user: event.user
    });

    // ボット自身の投稿は除外（ただしsubtypeがない通常メッセージは許可）
    if (event.bot_id) {
      console.log('⏭️  ボットメッセージをスキップ');
      return;
    }

    // 特定のsubtypeは除外（channel_join, message_deletedなど）
    const excludedSubtypes = ['channel_join', 'channel_leave', 'message_deleted', 'message_changed'];
    if (event.subtype && excludedSubtypes.includes(event.subtype)) {
      console.log(`⏭️  サブタイプ ${event.subtype} をスキップ`);
      return;
    }

    // スレッド返信の場合は未返信状態を解除 & タスク化
    if (event.thread_ts && event.thread_ts !== event.ts) {
      console.log(`✅ スレッド返信を検知 (返信者: ${event.user})`);
      console.log(`📍 検索条件: channel=${event.channel}, thread_ts=${event.thread_ts}, mentioned_user=${event.user}`);

      // 返信者がメンションされている未返信メンションのみを取得
      const { data: unrepliedMentions, error: fetchError } = await supabase
        .from('unreplied_mentions')
        .select('*')
        .eq('channel', event.channel)
        .eq('message_ts', event.thread_ts)
        .eq('mentioned_user', event.user)  // 返信者がメンションされているもののみ
        .is('replied_at', null);

      if (fetchError) {
        console.error('❌ 未返信メンション取得エラー:', fetchError);
      }

      console.log(`🔍 取得した未返信メンション数: ${unrepliedMentions?.length || 0}`);
      if (unrepliedMentions) {
        unrepliedMentions.forEach((m, idx) => {
          console.log(`  [${idx}] mentioned_user: ${m.mentioned_user}, text: "${m.message_text}"`);
        });
      }

      if (!fetchError && unrepliedMentions && unrepliedMentions.length > 0) {
        console.log(`📋 返信者 ${event.user} がメンションされている未返信を${unrepliedMentions.length}件タスク化します`);

        for (const mention of unrepliedMentions) {
          try {
            // タスクを作成
            const newTask = await taskService.createTask({
              text: `【返信あり】${mention.message_text}`,
              channel: mention.channel,
              messageTs: mention.message_ts,
              createdBy: 'auto_reply_system',
              assignee: mention.mentioned_user,
              priority: 2
            });

            // 未返信記録を更新（replied_at と task_id）
            await supabase
              .from('unreplied_mentions')
              .update({
                replied_at: new Date().toISOString(),
                auto_tasked: true,
                task_id: newTask.task_id
              })
              .eq('id', mention.id);

            console.log(`✅ タスク化完了: ${newTask.task_id} (対象: ${mention.mentioned_user})`);

            // Slackに通知
            await client.chat.postMessage({
              channel: event.channel,
              thread_ts: event.thread_ts,
              text: `✅ 返信を確認しました。タスクとして記録しました。\n\n*タスクID:* ${newTask.task_id}\n*担当:* <@${mention.mentioned_user}>\n*優先度:* 🟡 中\n\n完了したら \`/task-done ${newTask.task_id}\` を実行してください。`
            });
          } catch (taskError) {
            console.error(`⚠️ タスク化失敗 (ID: ${mention.id}):`, taskError.message);
          }
        }
      } else {
        // 未返信メンションがない場合は単純に返信マーク
        await unrepliedService.markAsReplied(
          event.channel,
          event.thread_ts,
          event.user
        );
      }
    }

    // メッセージテキストがない場合はスキップ
    if (!event.text) {
      console.log('⏭️  テキストなしメッセージをスキップ');
      return;
    }

    // メンションが含まれているかチェック
    const mentionRegex = /<@([A-Z0-9]+)>/g;
    const mentions = [...event.text.matchAll(mentionRegex)];

    if (mentions.length > 0) {
      console.log(`👀 メンション検出: ${mentions.length}件`);

      // メンションされたユーザーIDを抽出
      const mentionedUsers = mentions.map(match => match[1]);

      // ボット自身（サポ田さん）へのメンションは除外
      const botUserId = (await client.auth.test()).user_id;
      const nonBotMentions = mentionedUsers.filter(userId => userId !== botUserId);

      console.log(`🔍 ボット以外のメンション: ${nonBotMentions.length}件`, nonBotMentions);

      // ボットのみのメンションの場合はスキップ（app_mentionイベントで処理）
      if (nonBotMentions.length === 0) {
        console.log('⏭️  ボットのみのメンションはapp_mentionで処理');
        return;
      }

      // ボット以外へのメンションがある場合、AI分析
      if (nonBotMentions.length > 0) {
        console.log('🤖 AI分析を開始...');

        // AI分析してタスク判定
        const analysis = await unrepliedService.analyzeMentionAndRecord({
          text: event.text,
          channel: event.channel,
          messageTs: event.ts,
          mentionedUsers: nonBotMentions,
          senderUser: event.user
        }, isAIEnabled);

        console.log('📊 AI分析結果:', analysis);

        // タスクと判定された場合、確認通知を送信
        if (analysis.isTask) {
          const mentionList = nonBotMentions.map(id => `<@${id}>`).join(', ');

          // 分析結果の詳細を取得
          let detailText = '';
          console.log('🔍 analysis.analyses:', JSON.stringify(analysis.analyses, null, 2));
          console.log('🔍 analysis.recordedCount:', analysis.recordedCount);

          if (analysis.analyses && Array.isArray(analysis.analyses) && analysis.analyses.length > 0) {
            // タスクと判定された行のみ抽出
            const taskAnalyses = analysis.analyses.filter(a => a && a.isTask && typeof a.confidence === 'number');
            console.log('🔍 taskAnalyses:', taskAnalyses.length);

            if (taskAnalyses.length > 0) {
              // 平均確信度を計算
              const avgConfidence = Math.round(
                taskAnalyses.reduce((sum, a) => sum + a.confidence, 0) / taskAnalyses.length
              );
              const recordedCount = analysis.recordedCount || taskAnalyses.length;
              detailText = `\n*確信度:* ${avgConfidence}%\n*検知件数:* ${recordedCount}件のタスク依頼`;
              console.log('✅ detailText生成:', detailText);
            }
          } else {
            // 旧形式のフォールバック（念のため）
            console.log('⚠️ 旧形式のレスポンスを検出、デフォルト値を使用');
            detailText = `\n*検知件数:* ${analysis.recordedCount || nonBotMentions.length}件のタスク依頼`;
          }

          await client.chat.postMessage({
            channel: event.channel,
            thread_ts: event.ts,
            text: `👀 このメッセージをタスク依頼として検知しました\n\n*対象:* ${mentionList}${detailText}\n\n⏰ 2時間以内に返信がない場合、リマインド通知を送信します。`
          });

          logger.task(`タスク依頼検知: ${analysis.recordedCount}件のタスクを記録`);
          console.log('✅ タスク検知通知を送信しました');
        } else {
          console.log('❌ タスクではないと判定されました');
        }
      }
    } else {
      console.log('⏭️  メンションなしメッセージをスキップ');
    }
  } catch (error) {
    console.error('❌ メッセージ処理エラー:', error);
    console.error('スタックトレース:', error.stack);
  }
});

// ===============================
// 7. グローバルショートカット: 期限付きタスク作成モーダル
// ===============================
// 学習ポイント: グローバルショートカットは⚡アイコンから起動できる
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
            block_id: 'priority',
            optional: true,
            label: {
              type: 'plain_text',
              text: '優先度'
            },
            element: {
              type: 'static_select',
              action_id: 'priority_select',
              placeholder: {
                type: 'plain_text',
                text: '優先度を選択（任意・未選択時はAI判定）'
              },
              options: [
                {
                  text: {
                    type: 'plain_text',
                    text: '🔴 高 - 緊急・重要なタスク'
                  },
                  value: '1'
                },
                {
                  text: {
                    type: 'plain_text',
                    text: '🟡 中 - 通常のタスク'
                  },
                  value: '2'
                },
                {
                  text: {
                    type: 'plain_text',
                    text: '🟢 低 - 余裕があればやるタスク'
                  },
                  value: '3'
                }
              ]
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

// ===============================
// 8. モーダル送信時の処理
// ===============================
// 学習ポイント: view送信時のハンドラー、callback_idで識別
app.view('task_modal_submit', async ({ ack, body, view, client }) => {
  await ack();

  try {
    // フォームから値を取得
    const values = view.state.values;

    const taskText = values.task_text.text_input.value;
    const assignee = values.assignee.assignee_select.selected_user;
    const channel = values.channel.channel_select.selected_channel;
    const dueDate = values.due_date.date_select.selected_date; // YYYY-MM-DD
    const dueTime = values.due_time.time_select?.selected_time; // HH:MM
    const selectedPriority = values.priority.priority_select?.selected_option?.value; // 優先度（任意）

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

    // AI機能: タスク整形と優先度判定
    let formattedText = taskText;
    let priority = 2; // デフォルト: 中優先度

    // ユーザーが優先度を選択している場合はそれを使用
    if (selectedPriority) {
      priority = parseInt(selectedPriority);
      console.log(`👤 ユーザーが優先度を選択: ${getPriorityLabel(priority)}`);
    } else if (isAIEnabled) {
      // 優先度が選択されていない場合、AI判定を実行
      try {
        // タスクテキストを整形
        if (process.env.AI_FORMAT_ENABLED === 'true') {
          console.log('🤖 タスク整形を開始');
          formattedText = await aiService.formatTaskText(taskText);
        }

        // 優先度を判定
        if (process.env.AI_PRIORITY_ENABLED === 'true') {
          console.log('🤖 優先度判定を開始（ユーザー未選択のため）');
          priority = await aiService.determinePriority(formattedText, dueDateTimestamp);
        }
      } catch (aiError) {
        console.error('⚠️ AI処理エラー（タスク作成は続行）:', aiError.message);
      }
    }

    // タスクをデータベースに作成
    const newTask = await taskService.createTask({
      text: formattedText,
      channel: channel,
      messageTs: `manual_${Date.now()}`, // 手動作成の場合は特殊なTS
      createdBy: body.user.id,
      assignee: assignee,
      dueDate: dueDateTimestamp,
      priority: priority
    });

    // チャンネルに通知
    let notificationText = `✅ タスクを作成しました！\n\n*タスクID:* ${newTask.task_id}\n*内容:* ${formattedText}\n*担当:* <@${assignee}>\n*優先度:* ${getPriorityEmoji(priority)} ${getPriorityLabel(priority)}`;

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

    console.log(`タスク作成（モーダル経由）: ${newTask.task_id} (優先度: ${getPriorityLabel(priority)})`);
  } catch (error) {
    console.error('タスク作成エラー（モーダル）:', error);
  }
});

// ===============================
// 9. アプリ起動
// ===============================
(async () => {
  // データベース接続確認
  const isDbConnected = await checkConnection();
  if (!isDbConnected) {
    logger.failure('データベース接続に失敗しました。環境変数を確認してください。');
    process.exit(1);
  }

  await app.start();
  logger.success('サポ田さんが起動しました！');

  // リマインダーcronジョブを開始
  reminderService.startReminderJobs(app.client);

  // Webサーバー（API）を起動
  require('./server.js');
  logger.success('APIサーバーも起動しました！');
})();
