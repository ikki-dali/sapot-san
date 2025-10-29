const tagService = require('../../services/tagService');
const logger = require('../../utils/logger');

/**
 * 全タグ一覧を取得
 */
async function getAllTags(req, res) {
  try {
    const tags = await tagService.getAllTags();

    logger.success('タグ一覧取得成功', { count: tags.length });

    res.json({
      success: true,
      data: tags
    });
  } catch (error) {
    logger.failure('タグ一覧取得エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'タグ一覧の取得に失敗しました'
    });
  }
}

/**
 * タグを作成
 */
async function createTag(req, res) {
  try {
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'タグ名は必須です'
      });
    }

    const newTag = await tagService.createTag({
      name,
      color: color || '#6c757d'
    });

    logger.success('タグ作成成功', { tag: newTag.name });

    res.json({
      success: true,
      data: newTag
    });
  } catch (error) {
    logger.failure('タグ作成エラー', { error: error.message });

    if (error.code === '23505') { // unique_violation
      return res.status(409).json({
        success: false,
        error: 'そのタグ名は既に存在します'
      });
    }

    res.status(500).json({
      success: false,
      error: 'タグの作成に失敗しました'
    });
  }
}

/**
 * タグを削除
 */
async function deleteTag(req, res) {
  try {
    const { id } = req.params;

    await tagService.deleteTag(parseInt(id));

    logger.success('タグ削除成功', { id });

    res.json({
      success: true,
      message: 'タグを削除しました'
    });
  } catch (error) {
    logger.failure('タグ削除エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'タグの削除に失敗しました'
    });
  }
}

/**
 * タスクにタグを追加
 */
async function addTagsToTask(req, res) {
  try {
    const { taskId } = req.params;
    const { tagIds } = req.body;

    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'タグIDの配列は必須です'
      });
    }

    await tagService.addTagsToTask(taskId, tagIds);

    logger.success('タスクタグ追加成功', { taskId, count: tagIds.length });

    res.json({
      success: true,
      message: 'タグを追加しました'
    });
  } catch (error) {
    logger.failure('タスクタグ追加エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'タグの追加に失敗しました'
    });
  }
}

/**
 * タスクからタグを削除
 */
async function removeTagFromTask(req, res) {
  try {
    const { taskId, tagId } = req.params;

    await tagService.removeTagFromTask(taskId, parseInt(tagId));

    logger.success('タスクタグ削除成功', { taskId, tagId });

    res.json({
      success: true,
      message: 'タグを削除しました'
    });
  } catch (error) {
    logger.failure('タスクタグ削除エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'タグの削除に失敗しました'
    });
  }
}

/**
 * タスクのタグ一覧を取得
 */
async function getTaskTags(req, res) {
  try {
    const { taskId } = req.params;

    const tags = await tagService.getTaskTags(taskId);

    logger.success('タスクタグ取得成功', { taskId, count: tags.length });

    res.json({
      success: true,
      data: tags
    });
  } catch (error) {
    logger.failure('タスクタグ取得エラー', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'タグの取得に失敗しました'
    });
  }
}

module.exports = {
  getAllTags,
  createTag,
  deleteTag,
  addTagsToTask,
  removeTagFromTask,
  getTaskTags
};
