const { supabase } = require('../db/connection');
// taskServiceは循環依存を避けるため、使用箇所で遅延読み込み
const aiService = require('./aiService');
const { replaceMentionsWithNames } = require('../utils/helpers');

/**
 * メンションを記録
 * @param {Object} mentionData - メンションデータ
 * @returns {Promise<Object|null>} 作成されたレコード、または既存の場合null
 */
async function recordMention(mentionData) {
  try {
    const { data, error } = await supabase
      .from('unreplied_mentions')
      .insert([{
        channel: mentionData.channel,
        message_ts: mentionData.messageTs,
        mentioned_user: mentionData.mentionedUser,
        mentioner_user: mentionData.mentionerUser,
        message_text: mentionData.text,
        priority: mentionData.priority || 2  // デフォルトは中（2）
      }])
      .select()
      .single();

    if (error) {
      // 既存のメンション（重複）は無視
      if (error.code === '23505') { // unique_violation
        console.log(`ℹ️ 既存のメンション（スキップ）: ${mentionData.channel}/${mentionData.messageTs}`);
        return null;
      }
      throw error;
    }

    console.log(`📝 メンション記録: ${mentionData.channel}/${mentionData.messageTs}`);
    return data;
  } catch (error) {
    console.error('❌ メンション記録エラー:', error.message);
    // エラーが起きてもアプリは継続
    return null;
  }
}

/**
 * 返信を記録（未返信状態を解除）
 * @param {string} channel - チャンネルID
 * @param {string} threadTs - スレッドのタイムスタンプ
 * @param {string} userId - 返信したユーザーID
 * @returns {Promise<Object|null>} 更新されたレコード
 */
async function markAsReplied(channel, threadTs, userId) {
  try {
    const { data, error } = await supabase
      .from('unreplied_mentions')
      .update({
        replied_at: new Date().toISOString()
      })
      .eq('channel', channel)
      .eq('message_ts', threadTs)
      .eq('mentioned_user', userId)
      .is('replied_at', null)
      .select();

    if (error) throw error;

    if (data && data.length > 0) {
      console.log(`✅ 返信記録: ${channel}/${threadTs} (${data.length}件)`);
    }

    return data;
  } catch (error) {
    console.error('❌ 返信記録エラー:', error.message);
    // エラーが起きてもアプリは継続
    return null;
  }
}

/**
 * 未返信メッセージを取得
 * @param {number} hoursThreshold - 何時間以上未返信のものを取得するか（0=全件取得）
 * @returns {Promise<Array>} 未返信メッセージの配列
 */
async function getUnrepliedMentions(hoursThreshold = 24) {
  try {
    let query = supabase
      .from('unreplied_mentions')
      .select('*')
      .is('replied_at', null)
      .eq('auto_tasked', false);

    // hoursThreshold が 0 より大きい場合のみ時間フィルタを適用
    if (hoursThreshold > 0) {
      const thresholdTime = new Date();
      thresholdTime.setHours(thresholdTime.getHours() - hoursThreshold);
      query = query.lt('mentioned_at', thresholdTime.toISOString());
    }

    const { data, error } = await query.order('mentioned_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('❌ 未返信メッセージ取得エラー:', error.message);
    return [];
  }
}

/**
 * 未返信メッセージを自動的にタスク化
 * @param {Object} mention - メンションオブジェクト
 * @returns {Promise<Object>} 作成されたタスク
 */
async function autoCreateTask(mention) {
  try {
    // 循環依存を避けるため、ここで遅延読み込み
    const taskService = require('./taskService');

    // タスクを作成
    const newTask = await taskService.createTask({
      text: `【未返信】${mention.message_text}`,
      channel: mention.channel,
      messageTs: mention.message_ts,
      createdBy: 'auto_system',
      assignee: mention.mentioned_user,
      priority: 2 // デフォルトは中優先度
    });

    // 未返信記録を更新
    const { error: updateError } = await supabase
      .from('unreplied_mentions')
      .update({
        auto_tasked: true,
        task_id: newTask.task_id
      })
      .eq('id', mention.id);

    if (updateError) {
      console.error('⚠️ 未返信記録更新エラー:', updateError.message);
    }

    console.log(`✅ 自動タスク化: ${newTask.task_id}`);
    return newTask;
  } catch (error) {
    console.error('❌ 自動タスク化エラー:', error.message);
    throw error;
  }
}

/**
 * 未返信メッセージをチェックしてリマインド通知を送信
 * @param {Object} slackClient - Slack Boltのclientオブジェクト
 * @param {number} hoursThreshold - 何時間以上未返信のものを対象にするか
 * @returns {Promise<number>} リマインド送信件数
 */
async function checkAndRemindUnreplied(slackClient, hoursThreshold = 24) {
  try {
    console.log(`🔔 未返信リマインドチェック開始（${hoursThreshold}時間以上）`);

    const unreplied = await getUnrepliedMentions(hoursThreshold);

    if (unreplied.length === 0) {
      console.log('✅ リマインド対象の未返信メッセージはありません');
      return 0;
    }

    console.log(`📋 ${unreplied.length}件の未返信メッセージにリマインド送信`);

    let sentCount = 0;

    for (const mention of unreplied) {
      try {
        const hoursElapsed = Math.round(
          (new Date() - new Date(mention.mentioned_at)) / (1000 * 60 * 60)
        );

        await sendReminderToMentionedUser(slackClient, mention, hoursElapsed);
        sentCount++;
      } catch (remindError) {
        console.error(`⚠️ リマインド送信失敗 (ID: ${mention.id}):`, remindError.message);
        // 次のメンションの処理を継続
      }
    }

    console.log(`✅ 未返信リマインド完了: ${sentCount}件送信`);
    return sentCount;
  } catch (error) {
    console.error('❌ 未返信リマインドエラー:', error);
    return 0;
  }
}

/**
 * 未返信メッセージを定期チェックして自動タスク化
 * @param {Object} slackClient - Slack Boltのclientオブジェクト
 * @param {number} hoursThreshold - 何時間以上未返信のものを対象にするか
 */
async function checkAndAutoTaskUnreplied(slackClient, hoursThreshold = 24) {
  try {
    console.log(`🔍 未返信メッセージチェック開始（${hoursThreshold}時間以上）`);

    const unreplied = await getUnrepliedMentions(hoursThreshold);

    if (unreplied.length === 0) {
      console.log('✅ 未返信メッセージはありません');
      return;
    }

    console.log(`📋 ${unreplied.length}件の未返信メッセージを発見`);

    for (const mention of unreplied) {
      try {
        // 自動タスク化
        const task = await autoCreateTask(mention);

        // Slackに通知
        const hoursElapsed = Math.round(
          (new Date() - new Date(mention.mentioned_at)) / (1000 * 60 * 60)
        );

        await slackClient.chat.postMessage({
          channel: mention.channel,
          thread_ts: mention.message_ts,
          text: `⚠️ *${hoursElapsed}時間以上返信がないため、自動的にタスク化しました*\n\n*タスクID:* ${task.task_id}\n*担当:* <@${mention.mentioned_user}>\n*優先度:* 🟡 中\n\n完了したら \`/task-done ${task.task_id}\` を実行してください。`
        });

        console.log(`📨 自動タスク化通知送信: ${task.task_id}`);
      } catch (taskError) {
        console.error(`⚠️ タスク化失敗 (ID: ${mention.id}):`, taskError.message);
        // 次のメンションの処理を継続
      }
    }

    console.log('✅ 未返信チェック完了');
  } catch (error) {
    console.error('❌ 未返信チェックエラー:', error);
  }
}

/**
 * 未返信統計を取得
 * @returns {Promise<Object>} 統計情報
 */
async function getUnrepliedStats() {
  try {
    // 未返信メッセージ総数
    const { count: unrepliedCount, error: unrepliedError } = await supabase
      .from('unreplied_mentions')
      .select('*', { count: 'exact', head: true })
      .is('replied_at', null)
      .eq('auto_tasked', false);

    if (unrepliedError) throw unrepliedError;

    // 自動タスク化済み数
    const { count: autoTaskedCount, error: autoTaskedError } = await supabase
      .from('unreplied_mentions')
      .select('*', { count: 'exact', head: true })
      .eq('auto_tasked', true);

    if (autoTaskedError) throw autoTaskedError;

    // 返信済み数
    const { count: repliedCount, error: repliedError } = await supabase
      .from('unreplied_mentions')
      .select('*', { count: 'exact', head: true })
      .not('replied_at', 'is', null);

    if (repliedError) throw repliedError;

    return {
      unreplied: unrepliedCount || 0,
      autoTasked: autoTaskedCount || 0,
      replied: repliedCount || 0,
      total: (unrepliedCount || 0) + (autoTaskedCount || 0) + (repliedCount || 0)
    };
  } catch (error) {
    console.error('❌ 統計取得エラー:', error.message);
    return {
      unreplied: 0,
      autoTasked: 0,
      replied: 0,
      total: 0
    };
  }
}

/**
 * メンションメッセージをAI分析して、タスクと判定されたら記録
 * @param {Object} messageData - メッセージデータ
 * @param {boolean} isAIEnabled - AI機能が有効かどうか
 * @param {Object} slackClient - Slack APIクライアント
 * @returns {Promise<Object|null>} 分析結果と記録結果
 */
async function analyzeMentionAndRecord(messageData, isAIEnabled, slackClient) {
  try {
    const { text, channel, messageTs, mentionedUsers, senderUser } = messageData;

    // メッセージを行ごとに分割
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    console.log(`📝 メッセージを${lines.length}行に分割しました`);

    let totalRecorded = 0;
    const allAnalyses = [];

    // 各行を個別に処理
    for (const line of lines) {
      // この行に含まれるメンションを抽出
      const mentionRegex = /<@([A-Z0-9]+)>/g;
      const lineMentions = [...line.matchAll(mentionRegex)].map(match => match[1]);

      if (lineMentions.length === 0) {
        // メンションがない行はスキップ
        continue;
      }

      // メンション部分を削除してクリーンなテキストを取得
      const cleanText = line.replace(/<@[A-Z0-9]+>/g, '').trim();

      if (!cleanText || cleanText.length === 0) {
        console.log('⚠️ メンション以外のテキストがない行をスキップ');
        continue;
      }

      // 絵文字から優先度を検出（🔴=高, 🟡=中, 🟢=低）
      // Slackでは絵文字が :red_circle: や :large_yellow_circle: のようなコードになるため、両方チェック
      let detectedPriority = 2; // デフォルトは中
      if (line.includes('🔴') || line.includes(':red_circle:')) {
        detectedPriority = 1; // 高
        console.log(`👤 優先度検出: 🔴 高`);
      } else if (line.includes('🟡') || line.includes(':yellow_circle:') || line.includes(':large_yellow_circle:')) {
        detectedPriority = 2; // 中
        console.log(`👤 優先度検出: 🟡 中`);
      } else if (line.includes('🟢') || line.includes(':green_circle:') || line.includes(':large_green_circle:')) {
        detectedPriority = 3; // 低
        console.log(`👤 優先度検出: 🟢 低`);
      }

      // 優先度絵文字を内容から除去（絵文字は目印なので保存時には含めない）
      const textWithoutPriorityEmoji = cleanText
        .replace(/🔴/g, '')
        .replace(/:red_circle:/g, '')
        .replace(/🟡/g, '')
        .replace(/:yellow_circle:/g, '')
        .replace(/:large_yellow_circle:/g, '')
        .replace(/🟢/g, '')
        .replace(/:green_circle:/g, '')
        .replace(/:large_green_circle:/g, '')
        .trim();

      console.log(`🔍 行を分析: "${textWithoutPriorityEmoji}" (対象: ${lineMentions.length}人)`);

      // AI機能が有効な場合はタスク判定、無効な場合はデフォルトでタスクとして記録
      let shouldRecord = true;
      let analysis = { isTask: true, confidence: 100, reason: 'AI機能が無効のため全てのメンションを記録' };

      if (isAIEnabled && process.env.AI_AUTO_TASK_ENABLED === 'true') {
        // タスクかどうかを判定（絵文字を除去したテキストで判定）
        analysis = await aiService.analyzeTaskRequest(textWithoutPriorityEmoji);

        // 確信度が70%以上の場合のみ記録
        shouldRecord = analysis.isTask && analysis.confidence >= 70;

        if (shouldRecord) {
          console.log(`✅ タスクと判定 (確信度: ${analysis.confidence}%): ${analysis.reason}`);
        } else {
          console.log(`❌ タスクではないと判定 (確信度: ${analysis.confidence}%): ${analysis.reason}`);
        }
      } else {
        console.log(`📝 AI機能無効のため、全メンションを記録します`);
      }

      // メンションを記録（AI判定でタスクと判定された場合、またはAI無効の場合）
      if (shouldRecord) {
        // メンションIDを既に除去したテキストを使用（メンション名は含めない）
        // textWithoutPriorityEmojiは既にメンションIDが除去されているので、そのまま使用
        let displayText = textWithoutPriorityEmoji;
        
        // 念のため、メンション名（@ユーザー名）が含まれている場合は除去
        // パターン: @で始まり、スペースや行末まで続く文字列を除去
        displayText = displayText
          .replace(/@[^\s@]+(\s+|$)/g, '') // @ユーザー名 とその後のスペースを除去
          .replace(/@[^\s@]+/g, '') // 残っている@ユーザー名も除去
          .replace(/^\s+/, '') // 先頭のスペースを除去
          .trim();
        
        console.log(`📝 タスクテキスト（メンション除去後）: "${displayText}"`);

        // この行でメンションされた各ユーザーに対して記録
        for (const mentionedUser of lineMentions) {
          const recorded = await recordMention({
            channel,
            messageTs,
            mentionedUser,
            mentionerUser: senderUser,
            text: displayText, // メンション置換済みのテキスト
            priority: detectedPriority  // 検出した優先度を渡す
          });

          if (recorded) {
            totalRecorded++;
            console.log(`📝 記録完了: ${mentionedUser} <- "${displayText}"`);
          }
        }

        allAnalyses.push({
          line: displayText,
          isTask: true,
          confidence: analysis.confidence,
          mentionCount: lineMentions.length,
          priority: detectedPriority  // 優先度を追加
        });
      } else {
        allAnalyses.push({
          line: cleanText,
          isTask: false,
          confidence: analysis.confidence,
          reason: analysis.reason
        });
      }
    }

    if (totalRecorded > 0) {
      return {
        isTask: true,
        recordedCount: totalRecorded,
        analyses: allAnalyses,
        mentionedUsers
      };
    }

    return {
      isTask: false,
      reason: 'タスクと判定された行がありませんでした',
      analyses: allAnalyses
    };
  } catch (error) {
    console.error('❌ メンション分析エラー:', error.message);
    return { isTask: false, reason: `エラー: ${error.message}` };
  }
}

/**
 * 未返信メッセージに対してリマインド通知を送信
 * @param {Object} slackClient - Slack Boltのclientオブジェクト
 * @param {Object} mention - メンションオブジェクト
 * @param {number} hoursElapsed - 経過時間
 */
async function sendReminderToMentionedUser(slackClient, mention, hoursElapsed) {
  try {
    await slackClient.chat.postMessage({
      channel: mention.channel,
      text: `<@${mention.mentioned_user}> さん\n\n⏰ *${hoursElapsed}時間前のメンションに未返信です*\n\n> ${mention.message_text}\n\nこのメッセージへの対応をお願いします。\n完了したら、このスレッドに返信してください。`,
      thread_ts: mention.message_ts
    });

    console.log(`📨 リマインド送信: <@${mention.mentioned_user}> (${hoursElapsed}時間経過)`);
  } catch (error) {
    console.error('❌ リマインド送信エラー:', error.message);
    throw error;
  }
}

module.exports = {
  recordMention,
  markAsReplied,
  getUnrepliedMentions,
  autoCreateTask,
  checkAndRemindUnreplied,
  checkAndAutoTaskUnreplied,
  getUnrepliedStats,
  analyzeMentionAndRecord,
  sendReminderToMentionedUser
};
