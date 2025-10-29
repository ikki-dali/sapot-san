const { supabase } = require('../db/connection');
const taskService = require('./taskService');

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
        message_text: mentionData.text
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
 * @param {number} hoursThreshold - 何時間以上未返信のものを取得するか
 * @returns {Promise<Array>} 未返信メッセージの配列
 */
async function getUnrepliedMentions(hoursThreshold = 24) {
  try {
    const thresholdTime = new Date();
    thresholdTime.setHours(thresholdTime.getHours() - hoursThreshold);

    const { data, error } = await supabase
      .from('unreplied_mentions')
      .select('*')
      .is('replied_at', null)
      .eq('auto_tasked', false)
      .lt('mentioned_at', thresholdTime.toISOString())
      .order('mentioned_at', { ascending: true });

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

module.exports = {
  recordMention,
  markAsReplied,
  getUnrepliedMentions,
  autoCreateTask,
  checkAndAutoTaskUnreplied,
  getUnrepliedStats
};
