/**
 * 自助查询接口模块
 * 秋秋奶瓶线 · Phase 2 · EL-5
 */

const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = '/Users/zhizhi/data';
const DEV_STATUS_FILE = path.join(DATA_DIR, 'dev-status.json');
const MODULE_PROGRESS_FILE = path.join(DATA_DIR, 'module-progress.json');
const SYSLOG_RECORDS_FILE = path.join(DATA_DIR, 'syslog-records.json');

/**
 * 查询开发者状态
 * @param {string} devId - 开发者ID，如 'DEV-004'
 * @returns {Object} 查询结果 + 人话摘要
 */
async function queryDeveloper(devId) {
  try {
    const data = await readJSON(DEV_STATUS_FILE);
    const developer = data.developers.find(d => d.dev_id === devId);
    
    if (!developer) {
      return {
        success: false,
        error: 'developer_not_found',
        message: `❌ 找不到开发者 ${devId}`
      };
    }
    
    return {
      success: true,
      data: developer,
      message: `🍼 ${developer.dev_name}（${devId}）· ${developer.current_phase} · ${developer.current_el} · ${developer.streak_count}连胜 · 最后活跃: ${new Date(developer.last_active).toLocaleString('zh-CN')}`
    };
  } catch (error) {
    return {
      success: false,
      error: 'server_error',
      message: '❌ 服务器开小差了，稍后再试'
    };
  }
}

/**
 * 查询模块进度
 * @param {string} moduleId - 模块ID，如 'M-DINGTALK'
 * @returns {Object} 查询结果 + 人话摘要
 */
async function queryModule(moduleId) {
  try {
    const data = await readJSON(MODULE_PROGRESS_FILE);
    const module = data.modules.find(m => m.module_id === moduleId);
    
    if (!module) {
      return {
        success: false,
        error: 'module_not_found',
        message: `❌ 找不到模块 ${moduleId}`
      };
    }
    
    const progressBar = generateProgressBar(module.progress_percent);
    
    return {
      success: true,
      data: module,
      message: `📦 ${module.module_name}（${moduleId}）\n${progressBar} ${module.progress_percent}%\n阶段: ${module.phase} · ${module.completed_items}/${module.total_items} 项完成 · 状态: ${module.status === 'completed' ? '✅ 已完成' : '🔄 进行中'}`
    };
  } catch (error) {
    return {
      success: false,
      error: 'server_error',
      message: '❌ 服务器开小差了，稍后再试'
    };
  }
}

/**
 * 查询最近SYSLOG记录
 * @param {number} limit - 返回条数，默认5
 * @returns {Object} 查询结果 + 人话摘要
 */
async function queryRecentSyslogs(limit = 5) {
  try {
    const data = await readJSON(SYSLOG_RECORDS_FILE);
    const records = data.records.slice(0, limit);
    
    if (records.length === 0) {
      return {
        success: true,
        data: [],
        message: '📭 暂无SYSLOG记录'
      };
    }
    
    const messageLines = ['📋 最近SYSLOG记录：'];
    records.forEach((r, i) => {
      const date = new Date(r.timestamp).toLocaleString('zh-CN');
      messageLines.push(`${i+1}. ${r.session_id} · ${r.dev_id} · ${r.el_level} · ${r.status === 'completed' ? '✅' : '⏳'} · ${date}`);
    });
    
    return {
      success: true,
      data: records,
      message: messageLines.join('\n')
    };
  } catch (error) {
    return {
      success: false,
      error: 'server_error',
      message: '❌ 服务器开小差了，稍后再试'
    };
  }
}

/**
 * 全局统计
 * @returns {Object} 统计结果 + 人话摘要
 */
async function queryStats() {
  try {
    const [devData, moduleData, syslogData] = await Promise.all([
      readJSON(DEV_STATUS_FILE),
      readJSON(MODULE_PROGRESS_FILE),
      readJSON(SYSLOG_RECORDS_FILE)
    ]);
    
    const activeDevs = devData.developers.filter(d => d.status === 'active').length;
    const totalStreak = devData.developers.reduce((sum, d) => sum + (d.streak_count || 0), 0);
    const totalSyslogs = syslogData.total_count;
    
    const completedModules = moduleData.modules.filter(m => m.status === 'completed').length;
    const totalModules = moduleData.modules.length;
    const moduleCompletionRate = totalModules ? Math.round((completedModules / totalModules) * 100) : 0;
    
    return {
      success: true,
      data: {
        activeDevs,
        totalStreak,
        totalSyslogs,
        completedModules,
        totalModules,
        moduleCompletionRate
      },
      message: `📊 全局统计\n👥 活跃开发者: ${activeDevs} 人\n🏆 总连胜数: ${totalStreak}\n📝 广播总数: ${totalSyslogs}\n📦 模块完成率: ${completedModules}/${totalModules} (${moduleCompletionRate}%)`
    };
  } catch (error) {
    return {
      success: false,
      error: 'server_error',
      message: '❌ 服务器开小差了，稍后再试'
    };
  }
}

/**
 * 生成进度条
 * @param {number} percent 0-100
 * @returns {string} 进度条字符串
 */
function generateProgressBar(percent) {
  const barLength = 10;
  const filled = Math.round(percent / 10);
  const empty = barLength - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * 读取JSON文件
 */
async function readJSON(filePath) {
  const data = await fs.readFile(filePath, 'utf8');
  return JSON.parse(data);
}

module.exports = {
  queryDeveloper,
  queryModule,
  queryRecentSyslogs,
  queryStats
};
