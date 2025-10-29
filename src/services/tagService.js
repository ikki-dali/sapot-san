const { supabase } = require('../db/connection');

/**
 * 全タグを取得
 * @returns {Promise<Array>} タグリスト
 */
async function getAllTags() {
  try {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('❌ タグ一覧取得エラー:', error.message);
    return [];
  }
}

/**
 * タグを作成
 * @param {Object} tagData - タグデータ {name, color}
 * @returns {Promise<Object>} 作成されたタグ
 */
async function createTag(tagData) {
  try {
    const { data, error } = await supabase
      .from('tags')
      .insert([{
        name: tagData.name,
        color: tagData.color || '#6c757d'
      }])
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ タグ作成: ${data.name}`);
    return data;
  } catch (error) {
    console.error('❌ タグ作成エラー:', error.message);
    throw error;
  }
}

/**
 * タグを削除
 * @param {number} tagId - タグID
 * @returns {Promise<boolean>} 削除成功フラグ
 */
async function deleteTag(tagId) {
  try {
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId);

    if (error) throw error;

    console.log(`✅ タグ削除: ID ${tagId}`);
    return true;
  } catch (error) {
    console.error('❌ タグ削除エラー:', error.message);
    throw error;
  }
}

/**
 * タスクにタグを追加
 * @param {string} taskId - タスクID
 * @param {Array<number>} tagIds - タグIDの配列
 * @returns {Promise<Array>} 追加されたタグリスト
 */
async function addTagsToTask(taskId, tagIds) {
  try {
    const records = tagIds.map(tagId => ({
      task_id: taskId,
      tag_id: tagId
    }));

    const { data, error } = await supabase
      .from('task_tags')
      .upsert(records, { onConflict: 'task_id,tag_id' })
      .select();

    if (error) throw error;

    console.log(`✅ タスク ${taskId} にタグ追加: ${tagIds.length}件`);
    return data || [];
  } catch (error) {
    console.error('❌ タスクタグ追加エラー:', error.message);
    throw error;
  }
}

/**
 * タスクからタグを削除
 * @param {string} taskId - タスクID
 * @param {number} tagId - タグID
 * @returns {Promise<boolean>} 削除成功フラグ
 */
async function removeTagFromTask(taskId, tagId) {
  try {
    const { error } = await supabase
      .from('task_tags')
      .delete()
      .eq('task_id', taskId)
      .eq('tag_id', tagId);

    if (error) throw error;

    console.log(`✅ タスク ${taskId} からタグ削除: ${tagId}`);
    return true;
  } catch (error) {
    console.error('❌ タスクタグ削除エラー:', error.message);
    throw error;
  }
}

/**
 * タスクの全タグを取得
 * @param {string} taskId - タスクID
 * @returns {Promise<Array>} タグリスト
 */
async function getTaskTags(taskId) {
  try {
    const { data, error } = await supabase
      .from('task_tags')
      .select(`
        tag_id,
        tags (
          id,
          name,
          color
        )
      `)
      .eq('task_id', taskId);

    if (error) throw error;

    // tags オブジェクトを展開
    return (data || []).map(item => item.tags);
  } catch (error) {
    console.error('❌ タスクタグ取得エラー:', error.message);
    return [];
  }
}

/**
 * 複数タスクのタグを一括取得
 * @param {Array<string>} taskIds - タスクIDの配列
 * @returns {Promise<Object>} taskId => タグ配列のマップ
 */
async function getMultipleTaskTags(taskIds) {
  try {
    const { data, error } = await supabase
      .from('task_tags')
      .select(`
        task_id,
        tags (
          id,
          name,
          color
        )
      `)
      .in('task_id', taskIds);

    if (error) throw error;

    // taskId でグループ化
    const result = {};
    taskIds.forEach(id => {
      result[id] = [];
    });

    (data || []).forEach(item => {
      if (!result[item.task_id]) {
        result[item.task_id] = [];
      }
      result[item.task_id].push(item.tags);
    });

    return result;
  } catch (error) {
    console.error('❌ 複数タスクタグ取得エラー:', error.message);
    return {};
  }
}

/**
 * タグでタスクを検索
 * @param {Array<number>} tagIds - タグIDの配列
 * @returns {Promise<Array>} タスクIDリスト
 */
async function getTaskIdsByTags(tagIds) {
  try {
    const { data, error } = await supabase
      .from('task_tags')
      .select('task_id')
      .in('tag_id', tagIds);

    if (error) throw error;

    // 重複を除去してタスクIDのみを返す
    return [...new Set((data || []).map(item => item.task_id))];
  } catch (error) {
    console.error('❌ タグ検索エラー:', error.message);
    return [];
  }
}

module.exports = {
  getAllTags,
  createTag,
  deleteTag,
  addTagsToTask,
  removeTagFromTask,
  getTaskTags,
  getMultipleTaskTags,
  getTaskIdsByTags
};
