/**
 * persona-studio · 进化日志记录器
 *
 * 功能：记录系统每一次自进化事件
 * 事件类型：profile_update / knowledge_extract / pattern_update /
 *           model_benchmark / quality_score / system_init
 */
const fs = require('fs');
const path = require('path');

const BRAIN_DIR = path.join(__dirname, '..', '..', 'brain');
const EVOLUTION_LOG_PATH = path.join(BRAIN_DIR, 'evolution-log.json');

/**
 * 加载进化日志
 */
function loadEvolutionLog() {
  try {
    return JSON.parse(fs.readFileSync(EVOLUTION_LOG_PATH, 'utf-8'));
  } catch {
    return {
      schema_version: '1.0',
      description: '系统进化日志',
      last_updated: null,
      total_events: 0,
      events: []
    };
  }
}

/**
 * 保存进化日志
 */
function saveEvolutionLog(log) {
  log.last_updated = new Date().toISOString();
  log.total_events = log.events.length;
  fs.writeFileSync(EVOLUTION_LOG_PATH, JSON.stringify(log, null, 2), 'utf-8');
}

/**
 * 记录进化事件
 * @param {string} type - 事件类型
 * @param {string} description - 事件描述
 * @param {object} metadata - 事件元数据
 */
function logEvent(type, description, metadata) {
  const log = loadEvolutionLog();

  const event = {
    id: 'EVT-' + Date.now(),
    type: type,
    description: description,
    metadata: metadata || {},
    timestamp: new Date().toISOString()
  };

  log.events.push(event);

  // 保留最近 1000 条
  if (log.events.length > 1000) {
    log.events = log.events.slice(-1000);
  }

  saveEvolutionLog(log);
  return event;
}

/**
 * 记录画像更新事件
 */
function logProfileUpdate(devId, fieldsUpdated) {
  return logEvent('profile_update', '用户画像更新: ' + devId, {
    dev_id: devId,
    fields_updated: fieldsUpdated || []
  });
}

/**
 * 记录知识提取事件
 */
function logKnowledgeExtract(devId, entriesCount, projectName) {
  return logEvent('knowledge_extract', '知识提取: ' + entriesCount + ' 条新知识', {
    dev_id: devId,
    entries_count: entriesCount,
    project: projectName || null
  });
}

/**
 * 记录模式更新事件
 */
function logPatternUpdate(patternNames, devId) {
  return logEvent('pattern_update', '模式识别: ' + (patternNames || []).join(', '), {
    dev_id: devId,
    patterns: patternNames || []
  });
}

/**
 * 记录质量评分事件
 */
function logQualityScore(devId, projectName, score) {
  return logEvent('quality_score', '质量评分: ' + projectName + ' = ' + score, {
    dev_id: devId,
    project: projectName,
    score: score
  });
}

/**
 * 记录模型评测事件
 */
function logModelBenchmark(modelsCount, routingChanges) {
  return logEvent('model_benchmark', '模型评测完成: ' + modelsCount + ' 个模型', {
    models_count: modelsCount,
    routing_changes: routingChanges || []
  });
}

/**
 * 获取最近事件
 * @param {number} limit - 数量限制
 * @param {string} type - 可选，按类型过滤
 * @returns {Array} 事件列表
 */
function getRecentEvents(limit, type) {
  const log = loadEvolutionLog();
  let events = log.events;

  if (type) {
    events = events.filter(function (e) { return e.type === type; });
  }

  return events.slice(-(limit || 20)).reverse();
}

module.exports = {
  logEvent,
  logProfileUpdate,
  logKnowledgeExtract,
  logPatternUpdate,
  logQualityScore,
  logModelBenchmark,
  getRecentEvents,
  loadEvolutionLog
};
