/**
 * 检查点系统 · L3 执行原子性保障
 *
 * 在执行链路的每个关键节点保存快照。
 * 如果后续步骤失败，自动回滚到最近的成功检查点。
 *
 * 检查点包含：
 * - Notion 数据库的变更前快照
 * - GitHub 操作前的 commit SHA
 * - 执行到哪一步
 *
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var executionLock = require('../middleware/execution-lock');

/**
 * 检查点管理器
 * @param {string} devId - 开发者编号
 * @param {string} executionId - 执行ID
 */
function CheckpointManager(devId, executionId) {
  this.devId = devId;
  this.executionId = executionId;
  this.checkpoints = [];
}

/**
 * 在执行关键操作前保存检查点
 * @param {string} label - 检查点标签
 * @param {Object} snapshotData - 快照数据 { type, action, pageId, previousValues, ... }
 * @returns {string} 检查点ID
 */
CheckpointManager.prototype.save = async function(label, snapshotData) {
  var checkpoint = {
    id: 'cp-' + (this.checkpoints.length + 1),
    label: label,
    data: snapshotData || {},
    timestamp: new Date().toISOString()
  };

  this.checkpoints.push(checkpoint);
  executionLock.saveCheckpoint(this.devId, checkpoint);

  return checkpoint.id;
};

/**
 * 回滚到指定检查点
 * 按逆序撤销检查点之后的所有操作
 * @param {string} checkpointId - 目标检查点 ID
 */
CheckpointManager.prototype.rollbackTo = async function(checkpointId) {
  var targetIndex = -1;
  for (var i = 0; i < this.checkpoints.length; i++) {
    if (this.checkpoints[i].id === checkpointId) {
      targetIndex = i;
      break;
    }
  }
  if (targetIndex === -1) {
    throw new Error('检查点 ' + checkpointId + ' 不存在');
  }

  // 从最后一个检查点开始逆序回滚
  var toRollback = this.checkpoints.slice(targetIndex + 1).reverse();

  for (var j = 0; j < toRollback.length; j++) {
    var cp = toRollback[j];
    try {
      await this.rollbackCheckpoint(cp);
    } catch (e) {
      console.error('[Checkpoint] 回滚 ' + cp.id + ' 失败:', e.message);
      await this.escalateToAdmin(cp, e);
    }
  }

  // 截断检查点列表
  this.checkpoints = this.checkpoints.slice(0, targetIndex + 1);
};

/**
 * 回滚单个检查点
 * @param {Object} checkpoint
 */
CheckpointManager.prototype.rollbackCheckpoint = async function(checkpoint) {
  var data = checkpoint.data;
  if (!data || !data.type) return;

  var notionService, githubService;

  switch (data.type) {
    case 'notion_write':
      notionService = require('./notion');
      if (data.action === 'create' && data.pageId && notionService.notion) {
        // 新建的页面 → 归档
        await notionService.notion.pages.update({
          page_id: data.pageId,
          archived: true
        });
      } else if (data.action === 'update' && data.pageId && data.previousValues && notionService.notion) {
        // 更新的页面 → 恢复原值
        await notionService.notion.pages.update({
          page_id: data.pageId,
          properties: data.previousValues
        });
      }
      break;

    case 'github_workflow':
      // Workflow 无法直接回滚，记录需要人工处理
      if (data.revertWorkflow) {
        githubService = require('./github');
        await githubService.triggerWorkflow(data.revertWorkflow, {
          original_run_id: String(data.runId || ''),
          reason: 'auto_rollback'
        });
      }
      break;

    case 'github_file':
      githubService = require('./github');
      if (data.previousSha) {
        // 文件存在之前的版本 → 恢复
        // 注意：这需要 GitHub API 的 update file 能力
        console.warn('[Checkpoint] GitHub 文件回滚需要人工介入: ' + data.path);
      }
      break;

    case 'initial':
      // 初始检查点，无需回滚操作
      break;

    default:
      console.warn('[Checkpoint] 未知检查点类型: ' + data.type);
  }
};

/**
 * 回滚失败时上报管理员
 * @param {Object} checkpoint
 * @param {Error} error
 */
CheckpointManager.prototype.escalateToAdmin = async function(checkpoint, error) {
  try {
    var notionService = require('./notion');
    var dbConfig = require('../config/databases');

    if (dbConfig.maintenanceLog && notionService.notion) {
      await notionService.writeToDB(dbConfig.maintenanceLog, {
        '标题': {
          title: [{ text: { content: '[紧急] 自动回滚失败 · ' + this.executionId } }]
        },
        '类型': { select: { name: '系统异常' } },
        '操作者': {
          rich_text: [{
            text: {
              content: '检查点 ' + checkpoint.id + ' (' + checkpoint.label +
                       ') 回滚失败: ' + error.message + '。需要系统管理员人工介入。'
            }
          }]
        }
      });
    }
  } catch (e) {
    console.error('[Checkpoint] 上报管理员失败:', e.message);
  }
};

module.exports = { CheckpointManager: CheckpointManager };
