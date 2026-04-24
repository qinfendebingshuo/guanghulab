/**
 * 🔧 工具注册初始化
 * 在服务启动时注册所有可用工具到灯塔的工具执行层
 */
const toolExecutor = require('./tool-executor');
const videoDispatch = require('./video-dispatch');

function initializeTools() {
  console.log('[🗼 灯塔] 开始注册工具...');
  
  // ── 视频生成工具 ──────────────────────────────────
  toolExecutor.registerTool('video.generate', {
    description: '使用即梦Seedance生成AI视频',
    parameters: {
      prompt: { type: 'string', description: '视频描述提示词', required: true },
      duration: { type: 'string', description: '时长: 5 或 10 秒', default: '5' },
      resolution: { type: 'string', description: '分辨率: 720p 或 1080p', default: '1080p' },
    },
    handler: async (args) => {
      const result = await videoDispatch.submitTask({
        prompt: args.prompt,
        duration: args.duration || '5',
        resolution: args.resolution || '1080p',
      });
      return { taskId: result.taskId, status: 'submitted', message: '视频生成任务已提交到即梦' };
    },
  });
  
  toolExecutor.registerTool('video.status', {
    description: '查询视频生成任务的进度',
    parameters: {
      taskId: { type: 'string', description: '任务ID', required: true },
    },
    handler: async (args) => {
      const result = await videoDispatch.queryTask(args.taskId);
      return result;
    },
  });
  
  // ── 系统信息工具 ──────────────────────────────────
  toolExecutor.registerTool('system.time', {
    description: '获取当前系统时间',
    parameters: {},
    handler: async () => {
      return {
        iso: new Date().toISOString(),
        local: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        timezone: 'Asia/Shanghai',
      };
    },
  });
  
  toolExecutor.registerTool('system.health', {
    description: '检查系统健康状态',
    parameters: {},
    handler: async () => {
      const llmClient = require('./llm-client');
      return {
        lighthouse: '🗼 active',
        llm: llmClient.getStatus(),
        uptime: Math.floor(process.uptime()) + 's',
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      };
    },
  });
  
  console.log(`[🗼 灯塔] 工具注册完成: ${toolExecutor.getToolList().length} 个工具就绪`);
}

module.exports = { initializeTools };
