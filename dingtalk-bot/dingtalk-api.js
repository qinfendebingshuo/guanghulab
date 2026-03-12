/**
 * dingtalk-api.js
 * 钉钉Bot消息发送 + 多维表格读写
 * 秋秋说：这个文件就像邮递员，负责送消息和更新表格
 */

const axios = require('axios');
const config = require('./config.json');

/**
 * 发送钉钉消息
 * @param {String} message - 要发送的广播内容
 * @param {String} webhook - 钉钉机器人webhook地址（可选，默认用config里的）
 * @returns {Promise<Object>} 发送结果
 */
async function sendDingTalkMessage(message, webhook = null) {
  try {
    const targetWebhook = webhook || config.dingtalk.webhook;
    
    // 如果配置的是占位符，则模拟发送成功（用于测试）
    if (targetWebhook.includes('YOUR_BOT_TOKEN')) {
      console.log('【测试模式】钉钉消息发送模拟：', message);
      return {
        success: true,
        simulated: true,
        message: '测试模式，未实际发送'
      };
    }
    
    const response = await axios.post(targetWebhook, {
      msgtype: 'text',
      text: {
        content: message
      }
    });
    
    return {
      success: true,
      data: response.data
    };
    
  } catch (error) {
    console.error('钉钉消息发送失败:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 更新多维表格（任务状态）
 * @param {Object} parsedLog - 解析后的SYSLOG
 * @param {String} newBroadcast - 生成的新广播
 * @returns {Promise<Object>} 更新结果
 */
async function updateBitable(parsedLog, newBroadcast) {
  try {
    const { appId, tableId } = config.bitable;
    
    // 如果配置的是占位符，则模拟更新成功（用于测试）
    if (appId.includes('YOUR_BITABLE_APP_ID')) {
      console.log('【测试模式】多维表格更新模拟：', { parsedLog, newBroadcast });
      return {
        success: true,
        simulated: true,
        message: '测试模式，未实际更新表格',
        oldTask: {
          status: '已完成',
          bcNumber: parsedLog.bcNumber
        },
        newTask: {
          status: '待执行',
          broadcast: newBroadcast
        }
      };
    }
    
    // 这里需要根据钉钉多维表格API实际文档实现
    // 以下是示例结构，妈妈后面有真实appId时秋秋再给完整代码
    
    // 1. 获取access_token（需要appKey和appSecret）
    const token = await getDingTalkToken();
    
    // 2. 查询旧任务
    const oldTask = await findTaskByBCNumber(token, appId, tableId, parsedLog.bcNumber);
    
    // 3. 更新旧任务状态为「已完成」
    if (oldTask && oldTask.recordId) {
      await updateTaskStatus(token, appId, tableId, oldTask.recordId, '已完成');
    }
    
    // 4. 添加新任务（待执行）
    const newTaskData = {
      bcNumber: extractNextBCNumber(parsedLog.bcNumber, parsedLog.phaseNum),
      devId: parsedLog.devId,
      phase: parsedLog.phaseNum ? parseInt(parsedLog.phaseNum, 10) + 1 : 1,
      status: '待执行',
      broadcast: newBroadcast,
      createdAt: new Date().toISOString()
    };
    
    await addNewTask(token, appId, tableId, newTaskData);
    
    // 5. 更新连胜记录（如果有）
    if (parsedLog.status === 'completed') {
      await updateStreak(token, appId, tableId, parsedLog.devId);
    }
    
    return {
      success: true,
      oldTaskUpdated: true,
      newTaskAdded: true
    };
    
  } catch (error) {
    console.error('多维表格更新失败:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 获取钉钉access_token（辅助函数）
 */
async function getDingTalkToken() {
  const { appKey, appSecret } = config.dingtalk;
  
  if (appKey.includes('YOUR_APP_KEY')) {
    return 'test_token';
  }
  
  // 实际获取token的逻辑
  const response = await axios.post('https://api.dingtalk.com/v1.0/oauth2/accessToken', {
    appKey,
    appSecret
  });
  
  return response.data.accessToken;
}

/**
 * 根据BC编号查找任务（辅助函数）
 */
async function findTaskByBCNumber(token, appId, tableId, bcNumber) {
  // 这里需要根据钉钉多维表格API实际实现
  // 返回 { recordId: 'xxx', fields: {...} }
  return null;
}

/**
 * 更新任务状态（辅助函数）
 */
async function updateTaskStatus(token, appId, tableId, recordId, status) {
  // 这里需要根据钉钉多维表格API实际实现
  return true;
}

/**
 * 添加新任务（辅助函数）
 */
async function addNewTask(token, appId, tableId, taskData) {
  // 这里需要根据钉钉多维表格API实际实现
  return true;
}

/**
 * 更新连胜记录（辅助函数）
 */
async function updateStreak(token, appId, tableId, devId) {
  // 这里需要根据钉钉多维表格API实际实现
  return true;
}

/**
 * 提取下一个BC编号
 */
function extractNextBCNumber(currentBC, currentPhase) {
  if (!currentBC) return 'BC-M17-001-ZZ';
  
  // 尝试解析当前BC编号，生成下一个
  // 格式：BC-XXX-YYY-ZZ，YYY是环节号部分
  const match = currentBC.match(/BC-([A-Z0-9]+)-([0-9]+)-ZZ/i);
  if (match) {
    const module = match[1];
    const phase = parseInt(match[2], 10);
    const nextPhase = currentPhase ? parseInt(currentPhase, 10) + 1 : phase + 1;
    return `BC-${module}-${nextPhase.toString().padStart(3, '0')}-ZZ`;
  }
  
  return 'BC-M17-001-ZZ';
}

module.exports = {
  sendDingTalkMessage,
  updateBitable
};