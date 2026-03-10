/**
 * broadcast-generator.js
 * 模型API调用 + 广播生成 + 格式校验
 * 秋秋说：这个文件就像小作家，根据解析出来的信息写新广播
 */

const axios = require('axios');
const config = require('./config.json');

/**
 * 调用模型API生成广播
 * @param {Object} parsedLog - parseSyslog 返回的解析结果
 * @param {Object} developerProfile - 开发者画像（可选）
 * @returns {Promise<Object>} 生成的广播对象
 */
async function generateBroadcast(parsedLog, developerProfile = {}) {
  try {
    // 1. 构建 prompt（给模型的提示词）
    const prompt = buildPrompt(parsedLog, developerProfile);
    
    // 2. 调用模型API
    const modelResponse = await callModelAPI(prompt);
    
    // 3. 解析模型返回的内容
    const broadcastText = modelResponse.choices?.[0]?.message?.content || modelResponse;
    
    // 4. 校验广播格式
    const validatedBroadcast = validateBroadcast(broadcastText, parsedLog);
    
    return {
      success: true,
      broadcast: validatedBroadcast,
      raw: broadcastText
    };
    
  } catch (error) {
    console.error('广播生成失败:', error.message);
    return {
      success: false,
      error: error.message,
      fallbackBroadcast: generateFallbackBroadcast(parsedLog) // 出错时用模板生成
    };
  }
}

/**
 * 构建 prompt
 */
function buildPrompt(parsedLog, developerProfile) {
  const { bcNumber, devId, phaseNum, status, summary } = parsedLog;
  
  // 基础信息
  let prompt = `你是一个工程广播生成器。根据以下SYSLOG信息，生成一条新的工程广播。

SYSLOG信息：
- BC编号：${bcNumber || '未知'}
- 开发者：${devId || '未知'}
- 环节号：${phaseNum || '未知'}
- 完成状态：${status || '未知'}
- 技术摘要：${summary || '无'}

`;
  
  // 如果有画像信息，加入
  if (Object.keys(developerProfile).length > 0) {
    prompt += `\n开发者画像：\n${JSON.stringify(developerProfile, null, 2)}\n`;
  }
  
  // 广播模板参考
  prompt += `\n请生成一条格式规范的广播，包含：
1. BC编号（格式：BC-XXX-XXX-ZZ）
2. 开发者信息（DEV-xxx）
3. 环节号
4. 完成状态（用emoji：completed用✅，partial用⚠️，blocked用🔴）
5. 下一环节建议
6. 验收标准提示

广播格式示例：
BC-M17-007-ZZ · DEV-004之之 · M17动态漫 · 环节7 · ✅ 完成 · 在线预览功能已实现，下一环节：分享嵌入

请直接返回广播文本，不要有其他解释。`;
  
  return prompt;
}

/**
 * 调用模型API
 */
async function callModelAPI(prompt) {
  const { url, key, model } = config.modelApi;
  
  // 如果配置的是占位符，则返回模拟数据（用于测试）
  if (key === 'YOUR_MODEL_API_KEY') {
    console.log('使用模拟模型API响应（测试模式）');
    
    // 修复：不使用 undefined 的 parsedLog，直接返回模拟广播
    return {
      choices: [
        {
          message: {
            content: `BC-M17-007-ZZ · DEV-004之之 · M-DINGTALK · 环节1 · ✅ 完成 · SYSLOG自动处理已实现，下一环节：多维表格联动`
          }
        }
      ]
    };
  }
  
  // 真实API调用
  const response = await axios.post(
    url,
    {
      model: model,
      messages: [
        { role: 'system', content: '你是一个工程广播生成助手，只返回广播文本，不返回其他内容。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    },
    {
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.data;
}

/**
 * 校验广播格式
 */
function validateBroadcast(broadcastText, parsedLog) {
  const result = {
    isValid: false,
    broadcast: broadcastText,
    issues: []
  };
  
  // 检查是否包含BC编号
  if (!broadcastText.includes('BC-')) {
    result.issues.push('缺少BC编号');
  }
  
  // 检查是否包含DEV编号
  if (!broadcastText.includes('DEV-')) {
    result.issues.push('缺少开发者信息');
  }
  
  // 检查是否包含环节号
  if (!broadcastText.includes('环节')) {
    result.issues.push('缺少环节号');
  }
  
  // 检查状态emoji
  const hasCompletedEmoji = broadcastText.includes('✅');
  const hasPartialEmoji = broadcastText.includes('⚠️');
  const hasBlockedEmoji = broadcastText.includes('🔴');
  
  if (!hasCompletedEmoji && !hasPartialEmoji && !hasBlockedEmoji) {
    result.issues.push('缺少状态emoji（✅/⚠️/🔴）');
  }
  
  // 如果没有问题，标记为有效
  if (result.issues.length === 0) {
    result.isValid = true;
  }
  
  return result;
}

/**
 * 生成备用广播（API调用失败时使用）
 */
function generateFallbackBroadcast(parsedLog) {
  const { bcNumber, devId, phaseNum, status } = parsedLog;
  
  const statusEmoji = status === 'completed' ? '✅' : 
                      status === 'partial' ? '⚠️' : '🔴';
  
  const nextPhase = phaseNum ? parseInt(phaseNum, 10) + 1 : '?';
  
  return `BC-${bcNumber || 'M17'}-${nextPhase}-ZZ · DEV-${devId || '004'}之之 · M-DINGTALK · 环节${phaseNum || '1'} · ${statusEmoji} 完成 · SYSLOG自动处理已触发（API调用失败，使用模板生成），下一环节：多维表格联动`;
}

module.exports = { generateBroadcast };
