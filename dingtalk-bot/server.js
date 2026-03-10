/**
 * server.js v2.0
 * 钉钉开发者工作台 · Phase1 · SYSLOG自动处理管线
 * 秋秋说：这个文件是心脏，把所有模块连接起来！
 */

const express = require('express');
const axios = require('axios');
const config = require('./config.json');
const { parseSyslog } = require('./syslog-parser.js');
const { generateBroadcast } = require('./broadcast-generator.js');
const { sendDingTalkMessage, updateBitable } = require('./dingtalk-api.js');

const app = express();
app.use(express.json()); // 解析JSON格式的请求体

// 启动日志
console.log(`🚀 钉钉开发者工作台 Phase1 启动中...`);
console.log(`📅 启动时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
console.log(`📡 监听端口: ${config.server.port}`);

/**
 * 健康检查接口（测试服务是否运行）
 */
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    module: 'M-DINGTALK Phase1',
    time: new Date().toISOString()
  });
});

/**
 * 钉钉Webhook接收接口
 * 钉钉机器人会把收到的消息POST到这个接口
 */
app.post('/webhook', async (req, res) => {
  // 立即返回200响应，避免钉钉超时重试
  res.status(200).send('success');
  
  try {
    // 从请求中提取消息内容
    const message = req.body.text?.content || req.body.content || JSON.stringify(req.body);
    
    console.log('\n========== 收到新消息 ==========');
    console.log(`时间: ${new Date().toLocaleString()}`);
    console.log(`消息: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
    
    // 第一步：解析SYSLOG
    console.log('🔍 步骤1: 解析SYSLOG...');
    const parsed = parseSyslog(message);
    
    // 如果不是SYSLOG格式，直接忽略
    if (!parsed.isSyslog) {
      console.log(`⏭️ 不是SYSLOG格式，忽略处理: ${parsed.error}`);
      return;
    }
    
    console.log('✅ SYSLOG解析成功:');
    console.log(`   - BC编号: ${parsed.bcNumber}`);
    console.log(`   - 开发者: ${parsed.devId}`);
    console.log(`   - 环节号: ${parsed.phaseNum}`);
    console.log(`   - 状态: ${parsed.status}`);
    console.log(`   - 摘要: ${parsed.summary || '无'}`);
    
    // 第二步：生成广播
    console.log('🤖 步骤2: 调用模型API生成广播...');
    const broadcastResult = await generateBroadcast(parsed);
    
    let broadcastText;
    if (broadcastResult.success) {
      broadcastText = broadcastResult.broadcast.broadcast || broadcastResult.broadcast;
      console.log('✅ 广播生成成功（模型API）');
    } else {
      broadcastText = broadcastResult.fallbackBroadcast;
      console.log('⚠️ 广播生成使用备用模板（API失败）');
    }
    
    console.log(`📢 生成的广播: ${broadcastText.substring(0, 100)}...`);
    
    // 第三步：发送广播给开发者
    console.log('📤 步骤3: 发送钉钉消息...');
    const sendResult = await sendDingTalkMessage(broadcastText);
    
    if (sendResult.success) {
      console.log('✅ 钉钉消息发送成功');
    } else {
      console.log('❌ 钉钉消息发送失败:', sendResult.error);
    }
    
    // 第四步：更新多维表格
    console.log('📊 步骤4: 更新多维表格...');
    const updateResult = await updateBitable(parsed, broadcastText);
    
    if (updateResult.success) {
      console.log('✅ 多维表格更新成功');
      if (updateResult.simulated) {
        console.log('   (测试模式，模拟更新)');
      }
    } else {
      console.log('❌ 多维表格更新失败:', updateResult.error);
    }
    
    console.log('========== 处理完成 ==========\n');
    
    // 记录处理日志（可选扩展）
    logProcessing(parsed, broadcastText, sendResult, updateResult);
    
  } catch (error) {
    console.error('💥 处理过程中发生未捕获的错误:', error);
  }
});

/**
 * 测试接口（妈妈可以用浏览器访问测试）
 * GET /test?msg=SYSLOG%20BC-M17-006-ZZ%20DEV-004%20环节6%20completed
 */
app.get('/test', async (req, res) => {
  const testMessage = req.query.msg || 'SYSLOG BC-M17-006-ZZ DEV-004 环节6 completed 摘要：在线预览功能已实现';
  
  try {
    console.log('\n========== 测试模式 ==========');
    console.log(`测试消息: ${testMessage}`);
    
    const parsed = parseSyslog(testMessage);
    
    if (!parsed.isSyslog) {
      return res.json({
        success: false,
        error: parsed.error,
        parsed
      });
    }
    
    const broadcastResult = await generateBroadcast(parsed);
    const broadcastText = broadcastResult.success ? broadcastResult.broadcast.broadcast : broadcastResult.fallbackBroadcast;
    
    res.json({
      success: true,
      parsed,
      broadcast: broadcastText,
      broadcastResult
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 简单的日志记录函数
 */
function logProcessing(parsed, broadcast, sendResult, updateResult) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    parsed,
    broadcast: broadcast.substring(0, 200),
    sendSuccess: sendResult.success,
    updateSuccess: updateResult.success
  };
  
  // 这里可以扩展为写入文件或数据库
  console.log('📝 处理日志已记录');
}

// 启动服务器
const server = app.listen(config.server.port, () => {
  console.log(`✅ 服务启动成功！`);
  console.log(`🌐 本地访问: http://localhost:${config.server.port}`);
  console.log(`🔗 Webhook地址: http://你的域名或IP:${config.server.port}/webhook`);
  console.log(`🧪 测试接口: http://localhost:${config.server.port}/test?msg=你的SYSLOG消息`);
  console.log('\n秋秋说：妈妈！系统跑起来啦！🎉');
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭服务...');
  server.close(() => {
    console.log('服务已关闭');
  });
});