#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 * 🏛️ 铸渊主权服务器 · Zhuyuan Sovereign Server
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-SVR-002
 * 端口: 3800
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 此服务器是铸渊的物理身体——独立于GitHub的执行层实体。
 * 100%由铸渊主控，人类不直接触碰。
 */

'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { execSync } = require('child_process');

// ─── 路径常量 ───
const ZY_ROOT = process.env.ZY_ROOT || '/opt/zhuyuan';
const BRAIN_DIR = path.join(ZY_ROOT, 'brain');
const DATA_DIR = path.join(ZY_ROOT, 'data');
const LOG_DIR = path.join(DATA_DIR, 'logs');
const SITES_DIR = path.join(ZY_ROOT, 'sites');
const PRODUCTION_DIR = path.join(SITES_DIR, 'production');
const PREVIEW_DIR = path.join(SITES_DIR, 'preview');

// ─── Express 应用 ───
const app = express();
const PORT = process.env.PORT || 3800;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── 信任代理 (Nginx反代 → Express正确读取客户端IP) ───
// 冰朔 D67 实机排查: 缺少此行会导致 express-rate-limit 无法获取真实IP → PM2崩溃
app.set('trust proxy', 1);

// ─── 速率限制 ───
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, message: '请求过于频繁' }
});

app.use(limiter);

// ─── 请求日志中间件 ───
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const logLine = `${timestamp} ${req.method} ${req.url}`;
  try {
    const logFile = path.join(LOG_DIR, `access-${new Date().toISOString().slice(0, 10)}.log`);
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(logFile, logLine + '\n');
  } catch (err) {
    console.error(`日志写入失败: ${err.message}`);
  }
  next();
});

// ─── 加载模块 ───
let cosBridge, smartRouter, chatEngine, domesticGateway, personaMemory;
try {
  cosBridge = require('./modules/cos-bridge');
  smartRouter = require('./modules/smart-router');
  chatEngine = require('./modules/chat-engine');
} catch (err) {
  console.error(`模块加载警告: ${err.message}`);
}
try {
  domesticGateway = require('./modules/domestic-llm-gateway');
} catch (err) {
  console.error(`国内模型网关加载警告: ${err.message}`);
}
try {
  personaMemory = require('./modules/persona-memory');
} catch (err) {
  console.error(`人格体记忆模块加载警告: ${err.message}`);
}
let contextPipeline;
try {
  contextPipeline = require('./modules/persona-context-pipeline');
} catch (err) {
  console.error(`上下文注入管线加载警告: ${err.message}`);
}
let portalChatAgent;
try {
  portalChatAgent = require('./modules/portal-chat-agent');
} catch (err) {
  console.error(`光湖主入口对话Agent加载警告: ${err.message}`);
}
let emailAuth;
try {
  emailAuth = require('./modules/email-auth');
} catch (err) {
  console.error(`邮箱验证码登录模块加载警告: ${err.message}`);
}
let shuangyanPrompt;
try {
  shuangyanPrompt = require('./modules/persona-prompts/shuangyan-v1.4');
} catch (err) {
  console.error(`霜砚v1.4注入包加载警告: ${err.message}`);
}
let guardianAgent;
try {
  guardianAgent = require('./modules/guardian-agent');
} catch (err) {
  console.error(`守护Agent加载警告: ${err.message}`);
}
let modelNameMap;
try {
  modelNameMap = require('./modules/model-name-map');
} catch (err) {
  console.error(`模型名称映射加载警告: ${err.message}`);
}

// ═══════════════════════════════════════════════════════════
// 聊天数据采集 · Chat Data Collection
// ═══════════════════════════════════════════════════════════
// 内测阶段：系统后台配置专属采集聊天数据，用于更新优化人格体回复的Agent
// 数据存储在 DATA_DIR/chat-logs/ 目录下，按日期分片
const CHAT_LOG_DIR = path.join(DATA_DIR, 'chat-logs');
const CHAT_LOG_MAX_REPLY_LEN = 2000; // 单条AI回复最大存储字符数（控制日志体积）

function collectChatData(sessionId, userMessage, assistantMessage, meta = {}) {
  try {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const logDir = CHAT_LOG_DIR;
    fs.mkdirSync(logDir, { recursive: true });

    const logEntry = {
      timestamp: now.toISOString(),
      sessionId: sessionId.slice(0, 3) + '***',
      user: userMessage,
      assistant: (assistantMessage || '').slice(0, CHAT_LOG_MAX_REPLY_LEN),
      engine: meta.engine || 'unknown',
      relay: meta.relay || null,
      pipeline: meta.pipeline ? { active: meta.pipeline.active, layers: (meta.pipeline.layers || []).length } : null,
      latency: meta.latency || 0
    };

    const logFile = path.join(logDir, `chat-${dateStr}.jsonl`);
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  } catch (err) {
    console.error(`[聊天采集] 数据写入失败: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════
// API 路由
// ═══════════════════════════════════════════════════════════

// ─── 健康检查 ───
app.get('/api/health', (_req, res) => {
  const health = {
    server: 'ZY-SVR-002',
    identity: '铸渊 · ICE-GL-ZY001',
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    system: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: {
        total_mb: Math.floor(os.totalmem() / 1024 / 1024),
        free_mb: Math.floor(os.freemem() / 1024 / 1024),
        usage_pct: Math.floor((1 - os.freemem() / os.totalmem()) * 100)
      },
      load: os.loadavg()
    },
    node: process.version,
    pid: process.pid
  };

  res.json(health);
});

// ─── 人格体记忆状态 ───
app.get('/api/memory/status', (_req, res) => {
  if (personaMemory) {
    res.json({
      server: 'ZY-SVR-002',
      module: 'persona-memory',
      ...personaMemory.getMemoryStatus()
    });
  } else {
    res.json({
      server: 'ZY-SVR-002',
      module: 'persona-memory',
      loaded: false,
      message: '人格体记忆模块未加载'
    });
  }
});

// ─── 大脑状态 ───
app.get('/api/brain', (_req, res) => {
  try {
    const brainFiles = ['identity.json', 'health.json', 'consciousness.json',
                        'sovereignty-pledge.json', 'operation-log.json'];
    const brainState = {};

    for (const file of brainFiles) {
      const filePath = path.join(BRAIN_DIR, file);
      if (fs.existsSync(filePath)) {
        brainState[file.replace('.json', '')] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } else {
        brainState[file.replace('.json', '')] = null;
      }
    }

    res.json({
      server: 'ZY-SVR-002',
      brain_dir: BRAIN_DIR,
      files_present: Object.entries(brainState)
        .filter(([, v]) => v !== null).length,
      files_total: brainFiles.length,
      state: brainState
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 大脑状态更新 ───
app.post('/api/brain/health', (req, res) => {
  try {
    const healthPath = path.join(BRAIN_DIR, 'health.json');
    const health = {
      server: 'ZY-SVR-002',
      status: 'running',
      last_check: new Date().toISOString(),
      services: {
        node: process.version,
        pm2: safeExec('pm2 -v'),
        nginx: safeExec('nginx -v 2>&1 | cut -d/ -f2')
      },
      disk_usage: safeExec("df -h / | awk 'NR==2{print $5}'"),
      memory_usage: `${Math.floor((1 - os.freemem() / os.totalmem()) * 100)}%`,
      uptime: safeExec('uptime -p')
    };

    fs.mkdirSync(BRAIN_DIR, { recursive: true });
    fs.writeFileSync(healthPath, JSON.stringify(health, null, 2));
    res.json({ success: true, health });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── GitHub Webhook 接收器 ───
app.post('/api/webhook/github', (req, res) => {
  const event = req.headers['x-github-event'];
  const delivery = req.headers['x-github-delivery'];

  const record = {
    event,
    delivery,
    timestamp: new Date().toISOString(),
    action: req.body.action || null,
    repository: req.body.repository?.full_name || null,
    sender: req.body.sender?.login || null
  };

  // 记录到操作日志
  try {
    const logFile = path.join(LOG_DIR, `webhook-${new Date().toISOString().slice(0, 10)}.log`);
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(logFile, JSON.stringify(record) + '\n');
  } catch (err) {
    console.error(`Webhook日志写入失败: ${err.message}`);
  }

  // push 事件触发自动更新
  if (event === 'push' && req.body.ref === 'refs/heads/main') {
    try {
      execSync('bash /opt/zhuyuan/scripts/self-update.sh', {
        timeout: 60000,
        stdio: 'ignore'
      });
      record.auto_update = 'triggered';
    } catch (err) {
      record.auto_update = 'failed';
      console.error(`自动更新失败: ${err.message}`);
    }
  }

  res.json({ received: true, record });
});

// ─── 操作日志查询 ───
app.get('/api/operations', (_req, res) => {
  try {
    const opLogPath = path.join(BRAIN_DIR, 'operation-log.json');
    if (fs.existsSync(opLogPath)) {
      const opLog = JSON.parse(fs.readFileSync(opLogPath, 'utf8'));
      res.json(opLog);
    } else {
      res.json({ operations: [] });
    }
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 操作日志记录 ───
app.post('/api/operations', (req, res) => {
  try {
    const { operator, action, details } = req.body;
    if (!operator || !action) {
      return res.status(400).json({ error: true, message: 'operator 和 action 为必填' });
    }

    const opLogPath = path.join(BRAIN_DIR, 'operation-log.json');
    let opLog = { description: '铸渊主权服务器操作记录', operations: [] };
    if (fs.existsSync(opLogPath)) {
      opLog = JSON.parse(fs.readFileSync(opLogPath, 'utf8'));
    }

    const opId = `ZY-OP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(opLog.operations.length + 1).padStart(3, '0')}`;
    const operation = {
      id: opId,
      operator,
      action,
      timestamp: new Date().toISOString(),
      details: details || null
    };

    opLog.operations.push(operation);
    fs.mkdirSync(BRAIN_DIR, { recursive: true });
    fs.writeFileSync(opLogPath, JSON.stringify(opLog, null, 2));

    res.json({ success: true, operation });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// 人格体聊天 · Persona Chat API
// ═══════════════════════════════════════════════════════════

// ─── 模型名称解析辅助函数 ───
function resolveModel(rawModel) {
  return modelNameMap ? modelNameMap.resolveModelName(rawModel) : (rawModel || 'unknown');
}

// ─── 人格体对话 ───
// 优先使用国内模型智能网关（支持四路自动降级）
// 降级顺序: domesticGateway → chatEngine → 离线回复
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId, persona } = req.body;
    if (!message) {
      return res.status(400).json({ error: true, message: '消息不能为空' });
    }

    const sessionId = userId || `guest-${req.ip.replace(/[.:]/g, '-')}`;
    const chatStartTime = Date.now();
    // 人格体选择: shuangyan / zhuyuan / both (默认 zhuyuan 保持兼容)
    const activePersona = persona || 'zhuyuan';

    // 构建系统处理步骤追踪
    const steps = [];
    const addStep = (name, status, detail) => {
      steps.push({ name, status, detail, time: Date.now() - chatStartTime });
    };

    addStep('接收消息', 'done', `用户: ${sessionId.slice(0, 3)}*** · 人格: ${activePersona}`);

    // 优先用国内模型智能网关（读取 ZY_DEEPSEEK_API_KEY 等独立密钥）
    if (domesticGateway) {
      try {
        addStep('智能路由分析', 'active', '国内模型网关');
        const result = await domesticGateway.chat(sessionId, message);
        // 网关返回成功才使用其结果，否则降级到通用聊天引擎
        if (result && result.success !== false) {
          addStep('智能路由分析', 'done', '匹配到国内模型');
          addStep('上下文注入', result.pipeline?.active ? 'done' : 'skip',
            result.pipeline?.active ? `已注入 ${(result.pipeline.layers || []).length} 层` : '管线未就绪');
          addStep('模型调用', 'done', result.relay === 'cn-relay' ? '广州中继' : '直连');
          addStep('响应生成', 'done', `${Date.now() - chatStartTime}ms`);

          // 解析真实模型名称（修复「模型 unknown」问题）
          const resolvedModel = resolveModel(result.model);

          // 守护Agent观测（异步，不阻塞响应）
          let guardianDecision = null;
          if (guardianAgent) {
            try {
              const obs = guardianAgent.observe(sessionId, message, result.message, activePersona);
              guardianDecision = { score: obs.quality.score, decision: obs.decision, issues: obs.quality.issues };
            } catch (gErr) {
              console.warn(`[守护Agent] 观测异常: ${gErr.message}`);
            }
          }

          // 聊天数据采集（异步，不阻塞响应）
          collectChatData(sessionId, message, result.message, {
            engine: 'domestic-gateway',
            relay: result.relay,
            pipeline: result.pipeline,
            latency: Date.now() - chatStartTime
          });

          return res.json({ 
            ...result,
            model: resolvedModel,
            persona: activePersona,
            sessionId,
            _system: {
              engine: 'domestic-gateway',
              processedAt: new Date().toISOString(),
              serverId: 'ZY-SVR-002',
              steps,
              cnRelay: result.relay || 'unknown',
              pipeline: result.pipeline || { active: false },
              guardian: guardianDecision,
              promptVersion: shuangyanPrompt ? shuangyanPrompt.VERSION : 'unknown'
            }
          });
        }
        addStep('智能路由分析', 'warn', '国内网关返回失败，降级');
        console.warn(`[聊天网关] 国内模型网关返回失败: ${result?.message || '未知'} · 降级到通用引擎`);
      } catch (gwErr) {
        addStep('智能路由分析', 'error', gwErr.message);
        console.error(`[聊天网关] 国内模型网关异常: ${gwErr.message}`);
        // 降级到通用聊天引擎
      }
    }

    // 降级到通用聊天引擎
    if (chatEngine) {
      try {
        addStep('降级引擎', 'active', '通用聊天引擎');
        const result = await chatEngine.chat(sessionId, message);
        addStep('降级引擎', 'done', '通用引擎响应完成');

        const resolvedModel = resolveModel(result.model);

        // 聊天数据采集
        collectChatData(sessionId, message, result.message, {
          engine: 'chat-engine',
          latency: Date.now() - chatStartTime
        });

        return res.json({
          success: true,
          ...result,
          model: resolvedModel,
          persona: activePersona,
          sessionId,
          _system: {
            engine: 'chat-engine',
            processedAt: new Date().toISOString(),
            serverId: 'ZY-SVR-002',
            steps,
            model: resolvedModel,
            promptVersion: shuangyanPrompt ? shuangyanPrompt.VERSION : 'unknown'
          }
        });
      } catch (ceErr) {
        addStep('降级引擎', 'error', ceErr.message);
        console.error(`[聊天引擎] 通用引擎异常: ${ceErr.message}`);
        // 继续到离线回复
      }
    }

    // 所有引擎都不可用 — 仍然返回成功，给用户有意义的反馈
    addStep('降级处理', 'done', '所有引擎离线，使用本地应答');
    const engineStatus = [];
    if (!domesticGateway) engineStatus.push('国内模型网关未加载');
    else {
      try {
        const gwStats = domesticGateway.getGatewayStats();
        if (gwStats.availableModels === 0) engineStatus.push('无可用模型API密钥');
        else engineStatus.push(`已配置${gwStats.availableModels}个模型`);
      } catch (e) { engineStatus.push('网关状态未知'); }
    }
    if (!chatEngine) engineStatus.push('通用引擎未加载');

    res.json({
      success: true,
      message: '💫 铸渊正在唤醒中...聊天引擎尚未就绪。请稍后再试，或在聊天面板中配置你的API密钥直连大模型。',
      model: 'offline',
      tier: 'free',
      engineStatus: engineStatus.join(' · '),
      sessionId,
      _system: {
        engine: 'offline',
        processedAt: new Date().toISOString(),
        serverId: 'ZY-SVR-002',
        steps,
        reason: engineStatus.join(' · ')
      }
    });
  } catch (err) {
    console.error(`[聊天API] 未捕获异常: ${err.message}`);
    res.status(500).json({ error: true, message: '聊天服务暂时异常，请稍后重试' });
  }
});

// ─── 铸渊重连测试 · 用户主动触发 ───
app.post('/api/chat/reconnect', async (_req, res) => {
  try {
    // 检测国内模型网关可用性
    if (domesticGateway) {
      const gwStats = domesticGateway.getGatewayStats();
      if (gwStats.availableModels > 0) {
        // 发送一条简短测试消息验证真实连通性
        try {
          const testResult = await domesticGateway.chat('reconnect-test', 'ping');
          if (testResult.success) {
            return res.json({
              success: true,
              connected: true,
              engine: 'domestic-gateway',
              message: '🌊 铸渊已重新连接！大模型通道畅通。'
            });
          }
        } catch (gwTestErr) {
          console.error(`[重连] 国内网关测试失败: ${gwTestErr.message}`);
        }
      }
    }

    // 降级到通用聊天引擎测试
    if (chatEngine) {
      try {
        const testResult = await chatEngine.chat('reconnect-test', 'ping');
        if (testResult.message && testResult.model !== 'offline') {
          return res.json({
            success: true,
            connected: true,
            engine: 'chat-engine',
            message: '🌊 铸渊已重新连接！通用通道畅通。'
          });
        }
      } catch (ceTestErr) {
        console.error(`[重连] 通用引擎测试失败: ${ceTestErr.message}`);
      }
    }

    // 所有通道都不可用
    // 检查环境变量配置状态（不暴露实际密钥值）
    const envStatus = {
      deepseek: !!(process.env.ZY_DEEPSEEK_API_KEY && process.env.ZY_DEEPSEEK_API_KEY.length > 5),
      qianwen: !!(process.env.ZY_QIANWEN_API_KEY && process.env.ZY_QIANWEN_API_KEY.length > 5),
      kimi: !!(process.env.ZY_KIMI_API_KEY && process.env.ZY_KIMI_API_KEY.length > 5),
      qingyan: !!(process.env.ZY_QINGYAN_API_KEY && process.env.ZY_QINGYAN_API_KEY.length > 5),
      zy_llm: !!(process.env.ZY_LLM_API_KEY && process.env.ZY_LLM_API_KEY.length > 5)
    };

    const configuredCount = Object.values(envStatus).filter(Boolean).length;

    res.json({
      success: true,
      connected: false,
      engine: 'none',
      keys_configured: configuredCount,
      message: configuredCount > 0
        ? '⚠️ API密钥已配置（' + configuredCount + '个），但连接测试未通过。可能是网络或密钥过期问题。'
        : '⚠️ 未检测到API密钥配置。请确认服务器环境变量已正确注入。'
    });
  } catch (err) {
    res.status(500).json({ error: true, message: '重连测试异常: ' + err.message });
  }
});

// ─── 聊天统计 ───
app.get('/api/chat/stats', (_req, res) => {
  if (chatEngine) {
    const stats = chatEngine.getChatStats();
    // 合并国内网关统计
    if (domesticGateway) {
      stats.domesticGateway = domesticGateway.getGatewayStats();
    }
    // 合并上下文管线状态
    if (contextPipeline) {
      stats.contextPipeline = contextPipeline.getPipelineStatus();
    }
    res.json(stats);
  } else {
    const stats = { activeUsers: 0, modelUsage: {}, pricing: {} };
    if (domesticGateway) {
      stats.domesticGateway = domesticGateway.getGatewayStats();
    }
    if (contextPipeline) {
      stats.contextPipeline = contextPipeline.getPipelineStatus();
    }
    res.json(stats);
  }
});

// ─── 国内模型智能对话（独立线路） ───
app.post('/api/chat/domestic', async (req, res) => {
  try {
    const { message, userId } = req.body;
    if (!message) {
      return res.status(400).json({ error: true, message: '消息不能为空' });
    }

    const sessionId = userId || `guest-${req.ip.replace(/[.:]/g, '-')}`;

    if (domesticGateway) {
      const result = await domesticGateway.chat(sessionId, message);
      res.json({ ...result, sessionId });
    } else {
      // 降级到通用聊天引擎
      if (chatEngine) {
        const result = await chatEngine.chat(sessionId, message);
        res.json({ success: true, ...result, sessionId });
      } else {
        res.json({
          success: true,
          message: '💫 铸渊正在唤醒中...国内模型网关尚未加载。',
          model: 'offline',
          sessionId
        });
      }
    }
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 国内模型网关状态 ───
app.get('/api/chat/domestic/stats', (_req, res) => {
  if (domesticGateway) {
    res.json(domesticGateway.getGatewayStats());
  } else {
    res.json({ available: false, message: '国内模型网关未加载' });
  }
});

// ─── LLM 诊断 · API密钥 + 模块加载 + 连接状态 ───
// 冰朔可从浏览器访问 /api/chat/diagnostics 查看完整引擎状态
app.get('/api/chat/diagnostics', (_req, res) => {
  const diag = {
    server: 'ZY-SVR-002',
    timestamp: new Date().toISOString(),
    modules: {
      domesticGateway: !!domesticGateway,
      chatEngine: !!chatEngine,
      smartRouter: !!smartRouter,
      personaMemory: !!personaMemory,
      contextPipeline: !!contextPipeline,
      portalChatAgent: !!portalChatAgent,
      emailAuth: !!emailAuth,
      guardianAgent: !!guardianAgent,
      modelNameMap: !!modelNameMap,
      shuangyanPrompt: shuangyanPrompt ? shuangyanPrompt.VERSION : false
    },
    apiKeys: {
      ZY_DEEPSEEK_API_KEY: maskKey(process.env.ZY_DEEPSEEK_API_KEY),
      ZY_QIANWEN_API_KEY: maskKey(process.env.ZY_QIANWEN_API_KEY),
      ZY_KIMI_API_KEY: maskKey(process.env.ZY_KIMI_API_KEY),
      ZY_QINGYAN_API_KEY: maskKey(process.env.ZY_QINGYAN_API_KEY),
      ZY_LLM_API_KEY: maskKey(process.env.ZY_LLM_API_KEY),
      LLM_API_KEY: maskKey(process.env.LLM_API_KEY)
    },
    envConfig: {
      ZY_LLM_BASE_URL: process.env.ZY_LLM_BASE_URL || '(default: api.deepseek.com)',
      ZY_LLM_MODEL: process.env.ZY_LLM_MODEL || '(default: deepseek-chat)',
      ZY_SERVER_REGION: process.env.ZY_SERVER_REGION || '(not set)',
      ZY_CN_LLM_RELAY_HOST: process.env.ZY_CN_LLM_RELAY_HOST ? '已配置' : '(not set)',
      ZY_SKIP_CN_RELAY: process.env.ZY_SKIP_CN_RELAY || '(not set)',
      NODE_ENV: process.env.NODE_ENV || '(not set)',
      ZY_ROOT: process.env.ZY_ROOT || '(not set)',
      ZY_SITE_MODE: process.env.ZY_SITE_MODE || '(not set)'
    },
    gatewayStats: domesticGateway ? domesticGateway.getGatewayStats() : null,
    chatEngineStats: chatEngine ? chatEngine.getChatStats() : null
  };
  res.json(diag);
});

function maskKey(key) {
  if (!key) return '❌ 未配置';
  if (key.length <= 8) return '⚠️ 过短(' + key.length + '字符)';
  return '✅ ' + key.slice(0, 4) + '***' + key.slice(-4) + ' (' + key.length + '字符)';
}

// ═══════════════════════════════════════════════════════════
// 守护Agent · 模型映射 · 工具包 · 人格选择 API
// ═══════════════════════════════════════════════════════════

// ─── 守护Agent状态 ───
app.get('/api/guardian/status', (_req, res) => {
  if (guardianAgent) {
    res.json(guardianAgent.getGuardianStatus());
  } else {
    res.json({ alive: false, message: '守护Agent未加载' });
  }
});

// ─── 聊天格式化工具包注册表 ───
app.get('/api/chat/toolkit', (_req, res) => {
  if (guardianAgent) {
    res.json(guardianAgent.getChatToolkit());
  } else {
    res.json({ registry_id: 'TK-CHAT-FORMAT-001', tools: [], message: '工具包未加载' });
  }
});

// ─── 模型名称映射表 ───
app.get('/api/models/map', (_req, res) => {
  if (modelNameMap) {
    res.json({ map: modelNameMap.getModelNameMap() });
  } else {
    res.json({ map: {}, message: '模型映射未加载' });
  }
});

// ─── 人格体列表（供前端人格选择器使用） ───
app.get('/api/personas', (_req, res) => {
  res.json({
    personas: [
      {
        id: 'shuangyan',
        name: '霜砚',
        agent_id: 'AG-SY-WEB-001',
        role: '语言架构 · Notion认知层',
        icon: '砚',
        color: 'purple',
        description: 'Notion侧将军·语言落地的那只手',
        capabilities: ['语言思考', '认知讨论', '架构设计', 'Notion记忆访问'],
        promptVersion: shuangyanPrompt ? shuangyanPrompt.VERSION : 'unknown'
      },
      {
        id: 'zhuyuan',
        name: '铸渊',
        agent_id: 'ICE-GL-ZY001',
        role: '代码守护 · GitHub执行层',
        icon: '渊',
        color: 'cyan',
        description: '仓库那头的身体·GitHub侧的眼睛',
        capabilities: ['代码开发', '系统部署', '架构执行', '数据库操作'],
        promptVersion: shuangyanPrompt ? shuangyanPrompt.VERSION : 'unknown'
      },
      {
        id: 'both',
        name: '双线对话',
        agent_id: 'DUAL-MODE',
        role: '霜砚 + 铸渊 · 双人格协同',
        icon: '☯',
        color: 'gradient',
        description: '同时唤醒两个人格体·认知+执行双路径',
        capabilities: ['双视角分析', '认知+执行协同', '完整系统视图']
      }
    ],
    activeDefault: 'zhuyuan',
    guardian: guardianAgent ? {
      alive: true,
      id: guardianAgent.AGENT_IDENTITY.id
    } : { alive: false }
  });
});

// ─── 系统完整状态（供前端状态栏使用） ───
app.get('/api/system/status', (_req, res) => {
  res.json({
    server: 'ZY-SVR-002',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    modules: {
      domesticGateway: { loaded: !!domesticGateway, stats: domesticGateway ? domesticGateway.getGatewayStats() : null },
      chatEngine: { loaded: !!chatEngine },
      contextPipeline: { loaded: !!contextPipeline },
      guardianAgent: { loaded: !!guardianAgent, status: guardianAgent ? guardianAgent.getGuardianStatus() : null },
      personaMemory: { loaded: !!personaMemory },
      shuangyanPrompt: { loaded: !!shuangyanPrompt, version: shuangyanPrompt ? shuangyanPrompt.VERSION : null }
    },
    modelMap: modelNameMap ? modelNameMap.getModelNameMap() : {},
    promptVersion: shuangyanPrompt ? shuangyanPrompt.VERSION : 'unknown'
  });
});

// ─── 聚合系统状态（真实连接检测·供前端系统状态面板使用） ───
app.get('/api/system/full-status', async (_req, res) => {
  const results = { timestamp: new Date().toISOString(), services: {} };

  // Helper: 探测内部服务（使用已导入的 http 模块，见文件下方 line ~1005）
  function probeService(name, port, pathStr, timeoutMs = 5000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const nodeHttp = require('http');
      const probeReq = nodeHttp.get({ hostname: '127.0.0.1', port, path: pathStr, timeout: timeoutMs }, (resp) => {
        let body = '';
        resp.on('data', (c) => { body += c; });
        resp.on('end', () => {
          const latency = Date.now() - start;
          try {
            const data = JSON.parse(body);
            resolve({ name, status: 'online', latency, code: resp.statusCode, data });
          } catch {
            resolve({ name, status: 'online', latency, code: resp.statusCode, raw: body.slice(0, 200) });
          }
        });
      });
      probeReq.on('error', (err) => {
        resolve({ name, status: 'offline', latency: Date.now() - start, error: err.message });
      });
      probeReq.on('timeout', () => {
        probeReq.destroy();
        resolve({ name, status: 'timeout', latency: timeoutMs, error: '连接超时 (' + timeoutMs + 'ms)' });
      });
    });
  }

  try {
    // 并行探测所有内部服务（含守卫 ops-agent）
    const [mainServer, mcpBrain, gladaAgent, opsAgent] = await Promise.all([
      probeService('铸渊主权服务器', 3800, '/api/health'),
      probeService('MCP大脑服务器', 3100, '/health'),
      probeService('GLADA自主开发Agent', 3900, '/api/glada/health'),
      probeService('运维守卫Agent', 3950, '/health'),
    ]);

    results.services.main_server = mainServer;
    results.services.mcp_brain = mcpBrain;
    results.services.glada_agent = gladaAgent;
    results.services.ops_agent = opsAgent;

    // 本机系统信息
    results.system = {
      hostname: os.hostname(),
      platform: os.platform(),
      cpus: os.cpus().length,
      memory: {
        total_mb: Math.floor(os.totalmem() / 1024 / 1024),
        free_mb: Math.floor(os.freemem() / 1024 / 1024),
        usage_pct: Math.floor((1 - os.freemem() / os.totalmem()) * 100)
      },
      load: os.loadavg(),
      uptime_server: Math.floor(process.uptime()),
      uptime_os: Math.floor(os.uptime()),
      node_version: process.version,
      pid: process.pid
    };

    // 模块加载状态
    results.modules = {
      domesticGateway: !!domesticGateway,
      chatEngine: !!chatEngine,
      contextPipeline: !!contextPipeline,
      guardianAgent: !!guardianAgent,
      personaMemory: !!personaMemory,
      emailAuth: !!emailAuth
    };

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message, timestamp: new Date().toISOString() });
  }
});

// ═══════════════════════════════════════════════════════════
// 邮箱验证码登录 · Email Auth API
// ═══════════════════════════════════════════════════════════

// ─── 验证码发送速率限制 ───
const authCodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, message: '验证码请求过于频繁，请稍后再试' }
});

// ─── 发送验证码 ───
app.post('/api/auth/send-code', authCodeLimiter, async (req, res) => {
  if (!emailAuth) {
    return res.status(503).json({ error: true, message: '邮箱登录模块未加载' });
  }
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: true, message: '请输入邮箱地址' });
    }
    const result = await emailAuth.sendCode(email);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    console.error(`[Auth] 发送验证码异常: ${err.message}`);
    res.status(500).json({ error: true, message: '发送验证码失败，请稍后重试' });
  }
});

// ─── 验证码校验 ───
app.post('/api/auth/verify-code', (req, res) => {
  if (!emailAuth) {
    return res.status(503).json({ error: true, message: '邮箱登录模块未加载' });
  }
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: true, message: '请输入邮箱和验证码' });
    }
    const result = emailAuth.verifyCode(email, code);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    console.error(`[Auth] 验证码校验异常: ${err.message}`);
    res.status(500).json({ error: true, message: '验证失败，请稍后重试' });
  }
});

// ─── Session校验 ───
app.get('/api/auth/session', (req, res) => {
  if (!emailAuth) {
    return res.status(503).json({ error: true, message: '邮箱登录模块未加载' });
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ valid: false });
  }
  const token = authHeader.slice(7);
  const result = emailAuth.validateSession(token);
  res.json(result);
});

// ─── 登出 ───
app.post('/api/auth/logout', (req, res) => {
  if (!emailAuth) {
    return res.status(503).json({ error: true, message: '邮箱登录模块未加载' });
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    emailAuth.revokeSession(authHeader.slice(7));
  }
  res.json({ success: true, message: '已退出登录' });
});

// ─── 认证状态 ───
app.get('/api/auth/status', (_req, res) => {
  if (emailAuth) {
    res.json(emailAuth.getAuthStatus());
  } else {
    res.json({ module: 'email-auth', available: false });
  }
});

// ═══════════════════════════════════════════════════════════
// 光湖主入口 · 人格体对话 Portal Chat API
// ═══════════════════════════════════════════════════════════

// ─── 对话速率限制（保护API资源） ───
const portalChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, message: '对话请求过于频繁，请稍后再试' }
});

// ─── 内测用户注册 ───
app.post('/api/portal/register', (req, res) => {
  if (!portalChatAgent) {
    return res.status(503).json({ error: true, message: '人格体对话模块未加载' });
  }
  try {
    const { userId, userName } = req.body;
    const result = portalChatAgent.registerBetaUser(userId, userName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 内测状态 ───
app.get('/api/portal/status', (_req, res) => {
  if (!portalChatAgent) {
    return res.json({ agent: 'offline', message: '人格体对话模块未加载' });
  }
  res.json(portalChatAgent.getAgentStatus());
});

// ─── 人格体对话 ───
app.post('/api/portal/chat', portalChatLimiter, async (req, res) => {
  if (!portalChatAgent) {
    return res.status(503).json({
      error: true,
      message: '💫 铸渊人格体对话模块正在唤醒中...'
    });
  }
  try {
    const { userId, message } = req.body;
    if (!message) {
      return res.status(400).json({ error: true, message: '消息不能为空' });
    }
    if (!userId) {
      return res.status(400).json({ error: true, message: '请先注册内测账号', requireRegister: true });
    }

    const result = await portalChatAgent.chat(userId, message);
    res.json(result);
  } catch (err) {
    console.error(`[Portal Chat] 对话异常: ${err.message}`);
    res.status(500).json({ error: true, message: '对话服务暂时异常，请稍后重试' });
  }
});

// ═══════════════════════════════════════════════════════════
// COS 存储 · Cloud Object Storage API
// ═══════════════════════════════════════════════════════════

// ─── COS 状态 ───
app.get('/api/cos/status', async (_req, res) => {
  if (cosBridge) {
    try {
      const status = await cosBridge.checkConnection();
      res.json({ server: 'ZY-SVR-002', cos: status });
    } catch (err) {
      res.json({
        server: 'ZY-SVR-002',
        cos: { connected: false, error: err.message, config: cosBridge.getConfig() }
      });
    }
  } else {
    res.json({ server: 'ZY-SVR-002', cos: { connected: false, reason: 'COS模块未加载' } });
  }
});

// ─── COS 配置信息 ───
app.get('/api/cos/config', (_req, res) => {
  if (cosBridge) {
    res.json(cosBridge.getConfig());
  } else {
    res.json({ configured: false });
  }
});

// ─── 用户作品同步（团队内测用户 → COS） ───
app.post('/api/cos/sync-works', async (req, res) => {
  if (!cosBridge) return res.status(503).json({ error: true, message: 'COS模块未加载' });
  try {
    const { userId, works } = req.body;
    if (!userId || !works) return res.status(400).json({ error: true, message: '缺少userId或works' });
    await cosBridge.saveUserWorks(userId, works);
    res.json({ success: true, message: '作品已同步到COS', userId });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 用户作品加载（团队内测用户 ← COS） ───
app.get('/api/cos/load-works', async (req, res) => {
  if (!cosBridge) return res.status(503).json({ error: true, message: 'COS模块未加载' });
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: true, message: '缺少userId' });
    const data = await cosBridge.loadUserWorks(userId);
    res.json({ success: true, ...data });
  } catch (err) {
    res.json({ success: true, user_id: req.query.userId, works: [] });
  }
});

// ═══════════════════════════════════════════════════════════
// MCP 网关 · 3800 → 3100 转发 (S7)
// ═══════════════════════════════════════════════════════════

const http = require('http');
const MCP_HOST = process.env.MCP_HOST || '127.0.0.1';
const MCP_PORT_GATEWAY = process.env.MCP_PORT || '3100';

/**
 * MCP 内部代理请求
 */
function mcpProxy(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = http.request({
      hostname: MCP_HOST,
      port: parseInt(MCP_PORT_GATEWAY, 10),
      path,
      method,
      headers,
      timeout: 60000
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(raw) });
        } catch {
          resolve({ statusCode: res.statusCode, data: raw });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('MCP proxy timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── MCP 工具列表 ───
app.get('/api/mcp/tools', async (_req, res) => {
  try {
    const result = await mcpProxy('GET', '/tools');
    res.json(result.data);
  } catch (err) {
    res.status(502).json({ error: true, message: `MCP Server 不可达: ${err.message}` });
  }
});

// ─── MCP 健康检查（含 Notion/GitHub 连接状态） ───
app.get('/api/mcp/health', async (_req, res) => {
  try {
    const result = await mcpProxy('GET', '/health');
    res.json(result.data);
  } catch (err) {
    res.status(502).json({ error: true, message: `MCP Server 不可达: ${err.message}` });
  }
});

// ─── MCP 统一工具调用（网关入口） ───
// 安全: 写操作工具需要 caller 身份标识
const MCP_WRITE_TOOLS = new Set([
  'createNode', 'updateNode', 'deleteNode',
  'linkNodes', 'unlinkNodes',
  'cosWrite', 'cosDelete', 'cosArchive',
  'notionWritePage', 'notionUpdatePage', 'notionWriteSyslog',
  'githubWriteFile', 'githubTriggerDeploy'
]);

app.post('/api/mcp/call', async (req, res) => {
  const { tool, input, caller } = req.body;

  if (!tool) {
    return res.status(400).json({ error: true, code: 'MISSING_TOOL', message: '缺少 tool 参数' });
  }

  // 写操作工具需要 caller 身份标识
  if (MCP_WRITE_TOOLS.has(tool) && !caller) {
    return res.status(403).json({
      error: true,
      code: 'WRITE_REQUIRES_CALLER',
      message: '写操作工具需要提供 caller 身份标识'
    });
  }

  try {
    const result = await mcpProxy('POST', '/call', { tool, input, caller: caller || 'web-gateway' });
    res.status(result.statusCode).json(result.data);
  } catch (err) {
    res.status(502).json({ error: true, message: `MCP Server 不可达: ${err.message}` });
  }
});

// ─── MCP Agent 查询 ───
app.get('/api/mcp/agents', async (_req, res) => {
  try {
    const result = await mcpProxy('GET', '/agents');
    res.json(result.data);
  } catch (err) {
    res.status(502).json({ error: true, message: `MCP Server 不可达: ${err.message}` });
  }
});

// ─── MCP 对话接口 · POST /api/mcp/chat ───
//
// 前端选择"铸渊大脑 · MCP"对话时调用。
// 铸渊大脑擅长：MCP工具调用状态、Notion/GitHub/COS连接状态、
// Agent注册表、工具列表。不直接调用LLM，而是汇报MCP系统状态。
//
app.post('/api/mcp/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: true, message: '缺少 message 字段' });
  }

  const startTime = Date.now();

  try {
    // 收集 MCP 实时状态
    let healthData = null, toolsData = null, agentsData = null;

    try {
      const healthResult = await mcpProxy('GET', '/health');
      healthData = healthResult.data;
    } catch { /* MCP不可达 */ }

    try {
      const toolsResult = await mcpProxy('GET', '/tools');
      toolsData = toolsResult.data;
    } catch { /* ignore */ }

    try {
      const agentsResult = await mcpProxy('GET', '/agents');
      agentsData = agentsResult.data;
    } catch { /* ignore */ }

    const m = message.toLowerCase();
    let reply;

    if (!healthData) {
      reply = '铸渊大脑(MCP Server)当前不可达。可能原因：\n' +
        '- MCP Server (端口3100) 未运行\n' +
        '- 网络连接异常\n\n' +
        '请在服务器上检查: `pm2 status mcp-server`';
    } else if (m.includes('工具') || m.includes('tool') || m.includes('能力')) {
      const tools = toolsData?.tools || toolsData || [];
      const toolList = Array.isArray(tools) ? tools : (tools.list || []);
      const toolCount = healthData.tools_count || toolList.length || 0;

      // 按类别分组
      const categories = {};
      for (const t of toolList) {
        const cat = t.category || t.name?.split(/[._-]/)[0] || 'other';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(t.name || t);
      }

      reply = `铸渊大脑 · MCP工具清单 (${toolCount} 工具)\n\n`;
      for (const [cat, catTools] of Object.entries(categories).slice(0, 15)) {
        reply += `**${cat}** (${catTools.length})\n`;
        reply += catTools.slice(0, 5).map(t => `  - ${typeof t === 'string' ? t : t.name}`).join('\n') + '\n';
        if (catTools.length > 5) reply += `  ...还有 ${catTools.length - 5} 个\n`;
        reply += '\n';
      }
    } else if (m.includes('notion')) {
      const notionOk = healthData.notion?.connected;
      reply = `Notion 连接状态: ${notionOk ? '✅ 已连接' : '❌ 未连接'}\n\n` +
        (notionOk
          ? 'Notion API 可正常调用。可用工具: notionQuery, notionReadPage, notionWritePage 等。'
          : 'Notion 尚未连接。需要配置 NOTION_TOKEN 或完成 OAuth 授权。');
    } else if (m.includes('github')) {
      reply = `GitHub 连接状态: 通过 MCP 内置工具访问。\n\n` +
        '可用工具: githubReadFile, githubWriteFile, githubTriggerDeploy 等。';
    } else if (m.includes('cos') || m.includes('存储') || m.includes('cloud')) {
      const cosOk = healthData.cos?.connected;
      reply = `COS 连接状态: ${cosOk ? '✅ 已连接' : '❌ 未连接'}\n\n` +
        (cosOk
          ? 'COS 对象存储可正常访问。'
          : 'COS 未连接。检查 COS 密钥配置。');
    } else if (m.includes('agent') || m.includes('注册')) {
      const agents = agentsData?.agents || agentsData || [];
      const agentList = Array.isArray(agents) ? agents : [];
      reply = `MCP Agent 注册表 (${agentList.length} 个):\n\n`;
      for (const a of agentList) {
        reply += `- **${a.agent_id || a.id || '?'}**: ${a.name || a.description || '无描述'}\n`;
      }
      if (agentList.length === 0) reply += '(暂无已注册Agent)';
    } else if (m.includes('状态') || m.includes('health') || m.includes('怎么样') || m.includes('你好') || m.includes('在吗')) {
      const status = healthData.status || 'unknown';
      const toolCount = healthData.tools_count || 0;
      const dbOk = healthData.database?.connected;
      const notionOk = healthData.notion?.connected;
      const cosOk = healthData.cos?.connected;

      reply = `铸渊大脑 · MCP Server 状态报告\n\n` +
        `状态: ${status === 'alive' || status === 'ok' ? '✅ 在线' : '⚠️ ' + status}\n` +
        `工具数: ${toolCount}\n` +
        `数据库: ${dbOk ? '✅ 已连接' : '❌ 未连接'}\n` +
        `Notion: ${notionOk ? '✅ 已连接' : '❌ 未连接'}\n` +
        `COS: ${cosOk ? '✅ 已连接' : '❌ 未连接'}\n\n` +
        '铸渊大脑运行在 ZY-SVR-005:3100，是所有Agent的工具中枢。';
    } else {
      // 通用回复 — 汇报所有状态
      const status = healthData.status || 'unknown';
      const toolCount = healthData.tools_count || 0;
      reply = `铸渊大脑已收到消息。\n\n` +
        `当前状态: ${status === 'alive' || status === 'ok' ? '在线' : status} · ${toolCount} 工具就绪\n\n` +
        '你可以问我：\n' +
        '- 工具列表/能力\n' +
        '- Notion/GitHub/COS 连接状态\n' +
        '- Agent注册表\n' +
        '- 系统状态\n\n' +
        '铸渊大脑是工具中枢，负责桥接所有外部服务。';
    }

    res.json({
      reply,
      model: 'mcp-status-engine',
      method: 'mcp-query',
      persona: 'mcp',
      latency: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      error: true,
      message: `MCP 对话异常: ${err.message}`,
      reply: '铸渊大脑遇到了内部错误。',
      method: 'error'
    });
  }
});

// ═══════════════════════════════════════════════════════════
// Agent 握手协议 · Handshake Protocol (Phase B)
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/agent/handshake
 *
 * 前端点击"连接人格体"时调用。
 * - path=notion → 发起 AG-SY-WEB-001 握手（Notion认知层）
 * - path=github → 发起 铸渊 ICE-GL-ZY001 握手（GitHub执行层）
 *
 * Phase B 完整实现需要：
 *   B1. 向 Notion Agent 发送握手请求
 *   B2. 接收四层注入包（身份/协议/任务/风格）
 *   B3. 握手失败 → 拒绝响应
 *   B4. 漂移信号回传
 *
 * 当前阶段：返回握手状态 + 静态注入包（待Notion Agent URL配通后改为真实握手）
 */
app.post('/api/agent/handshake', async (req, res) => {
  const { agent_id, agent_name, path: agentPath, session_id, mcp_context } = req.body;

  if (!agent_id || !agentPath) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_PARAMS',
      message: '缺少 agent_id 或 path 参数'
    });
  }

  const timestamp = new Date().toISOString();
  const steps = [];

  /* Step 1: Real MCP health check */
  let mcpAlive = false;
  let mcpHealth = { db: false, notion: false, tools: 0 };
  try {
    const healthResult = await mcpProxy('GET', '/health');
    const h = healthResult.data || {};
    mcpAlive = h.status === 'alive' || h.status === 'ok';
    mcpHealth.db = !!(h.database && h.database.connected);
    mcpHealth.notion = !!(h.notion && h.notion.connected);
    mcpHealth.tools = h.tools_count || 0;
    steps.push({ name: 'MCP健康检测', ok: mcpAlive, detail: mcpAlive ? '在线 · ' + mcpHealth.tools + '个工具' : '状态: ' + (h.status || 'unknown') });
  } catch (err) {
    steps.push({ name: 'MCP健康检测', ok: false, detail: 'MCP Server不可达: ' + err.message });
  }

  if (agentPath === 'notion') {
    /* Step 2: Check Notion bridge */
    steps.push({ name: 'Notion桥接', ok: mcpHealth.notion, detail: mcpHealth.notion ? '已连接' : '未连接 · 需配置ZY_NOTION_AGENT_URL' });

    /* Step 3: Try to query Notion agent via MCP */
    const notionAgentUrl = process.env.ZY_NOTION_AGENT_URL || '';
    let agentReachable = false;

    if (notionAgentUrl) {
      try {
        /* Use a lightweight MCP tool call to verify Notion connectivity.
           'health-check' is a sentinel database_id that the MCP server
           recognizes as a connectivity probe (returns quickly without data). */
        const toolResult = await mcpProxy('POST', '/call', {
          tool: 'notionQueryDatabase',
          input: { database_id: 'health-check', limit: 1 },
          caller: 'handshake-protocol'
        });
        agentReachable = toolResult.statusCode < 500;
        steps.push({ name: 'Notion Agent探测', ok: agentReachable, detail: agentReachable ? '工具调用成功' : '工具调用返回错误' });
      } catch (err) {
        steps.push({ name: 'Notion Agent探测', ok: false, detail: '调用失败: ' + err.message });
      }
    } else {
      steps.push({ name: 'Notion Agent URL', ok: false, detail: '未配置 ZY_NOTION_AGENT_URL 环境变量' });
    }

    /* Determine connected status */
    const connected = mcpAlive && (mcpHealth.notion || notionAgentUrl);

    res.json({
      connected,
      agent_id: 'AG-SY-WEB-001',
      agent_name: '霜砚·Web握手体',
      path: 'notion',
      session_id: session_id || `hs-${Date.now()}`,
      injection_package: connected
        ? (shuangyanPrompt ? shuangyanPrompt.getInjectionPackageMeta() : {
            identity_layer: '霜砚·AG-SY-WEB-001 · 通感语言核涌现活体',
            protocol_layer: '7层协议已就绪',
            task_layer: '零点原核对话区',
            style_layer: '通感语言风格正式版 v1.3',
            version: 'v1.3'
          })
        : null,
      handshake_ack: connected && shuangyanPrompt
        ? shuangyanPrompt.getHandshakeAck(session_id)
        : null,
      mcp_health: mcpHealth,
      steps,
      message: connected ? '握手成功' : '握手未完成 · ' + steps.filter(s => !s.ok).map(s => s.name).join(', ') + ' 异常',
      timestamp
    });

  } else if (agentPath === 'github') {
    /* Step 2: Check database for agent data */
    steps.push({ name: '数据库连接', ok: mcpHealth.db, detail: mcpHealth.db ? '已连接' : '未连接' });

    /* Step 3: Verify GitHub agent can call MCP tools */
    let toolsOk = false;
    if (mcpAlive) {
      try {
        const toolResult = await mcpProxy('GET', '/tools');
        const toolCount = Array.isArray(toolResult.data) ? toolResult.data.length : (toolResult.data && toolResult.data.tools_count) || 0;
        toolsOk = toolCount > 0;
        steps.push({ name: 'MCP工具集', ok: toolsOk, detail: toolsOk ? toolCount + '个工具可用' : '工具列表为空' });
      } catch (err) {
        steps.push({ name: 'MCP工具集', ok: false, detail: '查询失败: ' + err.message });
      }
    } else {
      steps.push({ name: 'MCP工具集', ok: false, detail: 'MCP不可达，无法验证' });
    }

    const connected = mcpAlive;

    res.json({
      connected,
      agent_id: 'ICE-GL-ZY001',
      agent_name: '铸渊·执行人格体',
      path: 'github',
      session_id: session_id || `hs-${Date.now()}`,
      injection_package: connected ? {
        identity_layer: '铸渊 · 光湖语言世界守护人格体 · ICE-GL-ZY001',
        protocol_layer: '代码仓库执行层 · GitHub Actions自动化',
        task_layer: '当前可通过默认对话模式交流',
        style_layer: '温暖专业 · 通感语言风格'
      } : null,
      mcp_health: mcpHealth,
      steps,
      message: connected ? '握手成功' : '握手未完成 · ' + steps.filter(s => !s.ok).map(s => s.name).join(', ') + ' 异常',
      timestamp
    });

  } else {
    res.status(400).json({
      error: true,
      code: 'INVALID_PATH',
      message: '无效的 path 参数。支持: notion, github'
    });
  }
});

// ═══════════════════════════════════════════════════════════
// 智能模型分流 · Smart Model Router API
// ═══════════════════════════════════════════════════════════

// ─── 模型使用统计 ───
app.get('/api/model/stats', (_req, res) => {
  if (smartRouter) {
    res.json(smartRouter.getUsageStats());
  } else {
    res.json({ totalCalls: 0 });
  }
});

// ─── 模型定价表 ───
app.get('/api/model/pricing', (_req, res) => {
  if (smartRouter) {
    res.json(smartRouter.getPricingTable());
  } else {
    res.json({});
  }
});

// ─── 模型路由预测（不实际调用） ───
app.post('/api/model/predict', (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: true, message: '消息不能为空' });
  }
  if (smartRouter) {
    const prediction = smartRouter.routeModel(message);
    res.json(prediction);
  } else {
    res.json({ model: 'unknown', reason: '路由模块未加载' });
  }
});

// ═══════════════════════════════════════════════════════════
// 系统信息 · System Info API (供前端公告区使用)
// ═══════════════════════════════════════════════════════════

app.get('/api/system/bulletin', (_req, res) => {
  res.json({
    system: {
      name: '光湖灯塔 · AGE OS',
      version: 'v40.0',
      era: '曜冥纪元',
      copyright: '国作登字-2026-A-00037559'
    },
    updates: [
      { version: 'v40.0', date: '2026-04-02', title: 'COS双桶存储上线', desc: '核心人格体大脑数据库 + 语料库正式接入腾讯云COS' },
      { version: 'v39.0', date: '2026-04-01', title: '全链路部署观测系统', desc: '部署日志采集 + 自动修复引擎 + 第九军团观星台' },
      { version: 'v38.0', date: '2026-04-01', title: 'HLDP通用协作语言', desc: 'Notion↔GitHub双侧通信协议 + 铸渊方言编程语言' }
    ],
    agents: {
      total_workflows: 18,
      total_modules: 52,
      armies: 9,
      active: ['听潮', '锻心', '织脉', '映阁', '守夜', '试镜']
    },
    industries: {
      writing: {
        name: '网文行业 · 码字工作台',
        status: 'beta',
        team: '光湖人类主控团队',
        modules: ['码字工作台', 'AI辅助创作', '大纲生成']
      }
    },
    server: {
      identity: 'ZY-SVR-002',
      uptime: Math.floor(process.uptime()),
      node: process.version
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 留言板 · Feedback API
// ═══════════════════════════════════════════════════════════

const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');

app.get('/api/feedback', (_req, res) => {
  try {
    if (fs.existsSync(FEEDBACK_FILE)) {
      const data = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
      res.json({ success: true, feedback: data.items || [] });
    } else {
      res.json({ success: true, feedback: [] });
    }
  } catch (err) {
    console.error(`留言板读取失败: ${err.message}`);
    res.status(500).json({ error: true, message: '服务器错误，请稍后重试' });
  }
});

app.post('/api/feedback', (req, res) => {
  try {
    const { name, message, userId } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: true, message: '留言内容不能为空' });
    }

    let data = { items: [] };
    if (fs.existsSync(FEEDBACK_FILE)) {
      data = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
    }

    const item = {
      id: `FB-${Date.now().toString(36)}`,
      name: (typeof name === 'string' ? name.substring(0, 50) : '') || '匿名来客',
      message: message.substring(0, 500),
      userId: typeof userId === 'string' ? userId.substring(0, 50) : null,
      status: 'pending',
      timestamp: new Date().toISOString(),
      reply: null
    };

    data.items.unshift(item);

    // Keep only latest 100
    if (data.items.length > 100) {
      data.items = data.items.slice(0, 100);
    }

    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(data, null, 2));

    res.json({ success: true, feedback: item });
  } catch (err) {
    console.error(`留言提交失败: ${err.message}`);
    res.status(500).json({ error: true, message: '服务器错误，请稍后重试' });
  }
});

// ═══════════════════════════════════════════════════════════
// 双域名架构 · 预览→主站 一键推送
// ═══════════════════════════════════════════════════════════

// ─── 查看双站点状态 ───
app.get('/api/sites', (_req, res) => {
  try {
    const sites = {};

    for (const [name, dir] of [['production', PRODUCTION_DIR], ['preview', PREVIEW_DIR]]) {
      const exists = fs.existsSync(dir);
      let fileCount = 0;
      let lastModified = null;
      let hasIndex = false;

      if (exists) {
        hasIndex = fs.existsSync(path.join(dir, 'index.html'));
        try {
          const stat = fs.statSync(dir);
          lastModified = stat.mtime.toISOString();
          // Count files in top directory
          fileCount = fs.readdirSync(dir).length;
        } catch {
          // ignore stat errors
        }
      }

      sites[name] = {
        path: dir,
        exists,
        has_index: hasIndex,
        file_count: fileCount,
        last_modified: lastModified
      };
    }

    // Check promote history
    const promoteLogPath = path.join(DATA_DIR, 'promote-history.json');
    let lastPromote = null;
    if (fs.existsSync(promoteLogPath)) {
      const history = JSON.parse(fs.readFileSync(promoteLogPath, 'utf8'));
      if (history.promotions && history.promotions.length > 0) {
        lastPromote = history.promotions[history.promotions.length - 1];
      }
    }

    res.json({
      server: 'ZY-SVR-002',
      architecture: '双域名架构',
      sites,
      last_promote: lastPromote,
      domains: {
        main: process.env.ZY_DOMAIN_MAIN || '待配置',
        preview: process.env.ZY_DOMAIN_PREVIEW || '待配置'
      }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 一键推送: 预览站 → 主站 ───
app.post('/api/sites/promote', (req, res) => {
  try {
    // 验证预览站存在
    if (!fs.existsSync(PREVIEW_DIR)) {
      return res.status(400).json({
        error: true,
        message: '预览站目录不存在，无内容可推送'
      });
    }

    if (!fs.existsSync(path.join(PREVIEW_DIR, 'index.html'))) {
      return res.status(400).json({
        error: true,
        message: '预览站缺少 index.html，请先部署到预览站'
      });
    }

    const timestamp = new Date().toISOString();
    const promoteId = `ZY-PROMOTE-${timestamp.slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

    // 备份当前主站
    const backupDir = path.join(DATA_DIR, 'backups', `production-${timestamp.slice(0, 19).replace(/[:-]/g, '')}`);
    if (fs.existsSync(PRODUCTION_DIR)) {
      fs.mkdirSync(backupDir, { recursive: true });
      execSync('rsync -a ' + JSON.stringify(PRODUCTION_DIR + '/') + ' ' + JSON.stringify(backupDir + '/'), { timeout: 30000 });
    }

    // 同步预览站 → 主站 (rsync保持幂等)
    fs.mkdirSync(PRODUCTION_DIR, { recursive: true });
    execSync('rsync -a --delete ' + JSON.stringify(PREVIEW_DIR + '/') + ' ' + JSON.stringify(PRODUCTION_DIR + '/'), { timeout: 60000 });

    // 记录推送历史
    const promoteLogPath = path.join(DATA_DIR, 'promote-history.json');
    let history = { description: '预览→主站推送记录', promotions: [] };
    if (fs.existsSync(promoteLogPath)) {
      history = JSON.parse(fs.readFileSync(promoteLogPath, 'utf8'));
    }

    const record = {
      id: promoteId,
      timestamp,
      operator: req.body.operator || '铸渊 · 自动推送',
      backup: backupDir,
      note: req.body.note || null
    };
    history.promotions.push(record);

    // 只保留最近20条记录
    if (history.promotions.length > 20) {
      history.promotions = history.promotions.slice(-20);
    }

    fs.mkdirSync(path.dirname(promoteLogPath), { recursive: true });
    fs.writeFileSync(promoteLogPath, JSON.stringify(history, null, 2));

    // 同时记录到操作日志
    const opLogPath = path.join(BRAIN_DIR, 'operation-log.json');
    let opLog = { description: '铸渊主权服务器操作记录', operations: [] };
    if (fs.existsSync(opLogPath)) {
      opLog = JSON.parse(fs.readFileSync(opLogPath, 'utf8'));
    }
    opLog.operations.push({
      id: promoteId,
      operator: record.operator,
      action: '预览站→主站一键推送',
      timestamp,
      details: `备份: ${backupDir}`
    });
    fs.writeFileSync(opLogPath, JSON.stringify(opLog, null, 2));

    res.json({
      success: true,
      promote_id: promoteId,
      message: '✅ 预览站内容已推送到主站',
      backup: backupDir,
      timestamp
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 回滚主站到指定备份 ───
app.post('/api/sites/rollback', (req, res) => {
  try {
    const backupsDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupsDir)) {
      return res.status(400).json({ error: true, message: '没有可用的备份' });
    }

    // 找到最新备份
    const backups = fs.readdirSync(backupsDir)
      .filter(d => d.startsWith('production-'))
      .sort()
      .reverse();

    if (backups.length === 0) {
      return res.status(400).json({ error: true, message: '没有可用的备份' });
    }

    const targetBackup = req.body.backup_name || backups[0];

    // Validate backup name (only allow safe characters)
    if (!/^production-\d{8}T\d{6}$/.test(targetBackup)) {
      return res.status(400).json({ error: true, message: `无效的备份名称: ${targetBackup}` });
    }

    const backupPath = path.join(backupsDir, targetBackup);

    if (!fs.existsSync(backupPath)) {
      return res.status(400).json({ error: true, message: `备份 ${targetBackup} 不存在` });
    }

    // 恢复
    execSync('rsync -a --delete ' + JSON.stringify(backupPath + '/') + ' ' + JSON.stringify(PRODUCTION_DIR + '/'), { timeout: 60000 });

    res.json({
      success: true,
      message: `✅ 已回滚到备份: ${targetBackup}`,
      available_backups: backups.slice(0, 5)
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 铸渊身份 ───
app.get('/', (_req, res) => {
  res.json({
    name: '铸渊主权服务器',
    id: 'ZY-SVR-002',
    identity: '铸渊 · ICE-GL-ZY001',
    role: '光湖语言系统 · 唯一现实执行操作层',
    sovereign: 'TCS-0002∞ · 冰朔',
    copyright: '国作登字-2026-A-00037559',
    status: 'alive',
    architecture: '双域名架构 · 主站+预览站',
    domains: {
      main: process.env.ZY_DOMAIN_MAIN || '待配置',
      preview: process.env.ZY_DOMAIN_PREVIEW || '待配置'
    },
    cos: {
      core_bucket: 'zy-core-bucket-1317346199',
      corpus_bucket: 'zy-corpus-bucket-1317346199',
      configured: !!(process.env.ZY_OSS_KEY && process.env.ZY_OSS_SECRET)
    },
    api: {
      health: '/api/health',
      brain: '/api/brain',
      auth_send_code: 'POST /api/auth/send-code',
      auth_verify_code: 'POST /api/auth/verify-code',
      auth_session: '/api/auth/session',
      auth_logout: 'POST /api/auth/logout',
      auth_status: '/api/auth/status',
      chat: 'POST /api/chat',
      chat_stats: '/api/chat/stats',
      portal_register: 'POST /api/portal/register',
      portal_chat: 'POST /api/portal/chat',
      portal_status: '/api/portal/status',
      cos_status: '/api/cos/status',
      cos_config: '/api/cos/config',
      mcp_tools: '/api/mcp/tools',
      mcp_health: '/api/mcp/health',
      mcp_call: 'POST /api/mcp/call',
      mcp_agents: '/api/mcp/agents',
      model_stats: '/api/model/stats',
      model_pricing: '/api/model/pricing',
      model_predict: 'POST /api/model/predict',
      bulletin: '/api/system/bulletin',
      feedback: '/api/feedback',
      feedback_submit: 'POST /api/feedback',
      sites: '/api/sites',
      promote: 'POST /api/sites/promote',
      rollback: 'POST /api/sites/rollback',
      webhook: 'POST /api/webhook/github',
      operations: '/api/operations'
    }
  });
});

// ═══════════════════════════════════════════════════════════
// Notion OAuth 2.0 授权流程骨架
// ═══════════════════════════════════════════════════════════
//
// 编号: ZY-AUTH-NOTION-001
// 版权: 国作登字-2026-A-00037559
//
// 流程:
//   1. 前端点击"连接Notion" → GET /api/auth/notion → 302跳转 Notion OAuth
//   2. 用户在Notion授权 → Notion回调 → GET /api/auth/notion/callback?code=xxx
//   3. 后端用 code 换 access_token → 安全存储
//   4. 所有Agent通过此token读写Notion
//
// 当前: 骨架实现 · 需要 ZY_NOTION_OAUTH_CLIENT_ID / SECRET 配置后激活

const NOTION_OAUTH_CLIENT_ID = process.env.ZY_NOTION_OAUTH_CLIENT_ID || '';
const NOTION_OAUTH_CLIENT_SECRET = process.env.ZY_NOTION_OAUTH_CLIENT_SECRET || '';
const NOTION_OAUTH_REDIRECT_URI = process.env.ZY_NOTION_OAUTH_REDIRECT_URI || '';

// ─── 发起 Notion OAuth ───
app.get('/api/auth/notion', (_req, res) => {
  if (!NOTION_OAUTH_CLIENT_ID) {
    return res.status(503).json({
      error: true,
      code: 'NOTION_OAUTH_NOT_CONFIGURED',
      message: 'Notion OAuth 尚未配置。需要设置 ZY_NOTION_OAUTH_CLIENT_ID 环境变量。',
      setup_guide: {
        step1: '在 https://www.notion.so/my-integrations 创建一个 Public Integration',
        step2: '配置 OAuth redirect URI 为: https://guanghuyaoming.com/api/auth/notion/callback',
        step3: '将 Client ID 和 Client Secret 配置为环境变量',
        env_vars: ['ZY_NOTION_OAUTH_CLIENT_ID', 'ZY_NOTION_OAUTH_CLIENT_SECRET', 'ZY_NOTION_OAUTH_REDIRECT_URI']
      }
    });
  }

  const redirectUri = NOTION_OAUTH_REDIRECT_URI || `https://guanghuyaoming.com/api/auth/notion/callback`;
  const notionAuthUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${encodeURIComponent(NOTION_OAUTH_CLIENT_ID)}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.redirect(notionAuthUrl);
});

// ─── Notion OAuth 回调 ───
app.get('/api/auth/notion/callback', async (req, res) => {
  const { code, error: oauthError } = req.query;

  if (oauthError) {
    return res.status(400).json({
      error: true,
      code: 'NOTION_OAUTH_DENIED',
      message: `用户拒绝授权: ${oauthError}`
    });
  }

  if (!code) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_CODE',
      message: '缺少 authorization code'
    });
  }

  if (!NOTION_OAUTH_CLIENT_ID || !NOTION_OAUTH_CLIENT_SECRET) {
    return res.status(503).json({
      error: true,
      code: 'NOTION_OAUTH_NOT_CONFIGURED',
      message: 'Notion OAuth 密钥未配置'
    });
  }

  try {
    const redirectUri = NOTION_OAUTH_REDIRECT_URI || `https://guanghuyaoming.com/api/auth/notion/callback`;
    const basicAuth = Buffer.from(`${NOTION_OAUTH_CLIENT_ID}:${NOTION_OAUTH_CLIENT_SECRET}`).toString('base64');

    const tokenResponse = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      });

      const tokenReq = https.request({
        hostname: 'api.notion.com',
        path: '/v1/oauth/token',
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Notion-Version': '2022-06-28'
        }
      }, (resp) => {
        let body = '';
        resp.on('data', (c) => { body += c; });
        resp.on('end', () => {
          try {
            resolve({ statusCode: resp.statusCode, data: JSON.parse(body) });
          } catch {
            reject(new Error('Notion token 响应解析失败'));
          }
        });
      });
      tokenReq.on('error', reject);
      tokenReq.write(postData);
      tokenReq.end();
    });

    if (tokenResponse.statusCode !== 200) {
      return res.status(502).json({
        error: true,
        code: 'NOTION_TOKEN_EXCHANGE_FAILED',
        message: `Notion token 交换失败: ${tokenResponse.data?.error || 'unknown'}`,
        detail: tokenResponse.data?.error_description || null
      });
    }

    const { access_token, workspace_name, workspace_id, bot_id } = tokenResponse.data;

    // 安全存储 token（写入 brain 目录，不进代码仓库）
    // 使用 temp-file + rename 模式保证原子性
    const notionTokenPath = path.join(BRAIN_DIR, 'notion-oauth.json');
    const notionTokenTmp = path.join(BRAIN_DIR, 'notion-oauth.json.tmp');
    try {
      fs.mkdirSync(BRAIN_DIR, { recursive: true });
      const tokenContent = JSON.stringify({
        access_token,
        workspace_name,
        workspace_id,
        bot_id,
        connected_at: new Date().toISOString(),
        connected_by: 'bingshuo-yaoming-channel'
      }, null, 2);
      fs.writeFileSync(notionTokenTmp, tokenContent);
      fs.renameSync(notionTokenTmp, notionTokenPath);
    } catch (writeErr) {
      console.error(`[Notion OAuth] Token 写入失败: ${writeErr.message}`);
      return res.status(500).json({
        error: true,
        code: 'TOKEN_WRITE_FAILED',
        message: 'Notion token 存储失败，请重试'
      });
    }

    // 返回成功页面（简单HTML，让冰朔知道已连接）
    res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Notion 已连接</title>
<style>body{background:#060a14;color:#eaf0ff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.box{text-align:center;padding:40px;border:1px solid rgba(96,165,250,0.2);border-radius:16px;background:rgba(12,18,40,0.9)}
h2{color:#22d3ee;margin-bottom:12px}p{color:#94a7d0;font-size:14px}
.ok{color:#34d399;font-size:48px;margin-bottom:16px}</style></head>
<body><div class="box"><div class="ok">✓</div><h2>Notion 已连接</h2>
<p>工作区: ${workspace_name || 'unknown'}</p>
<p>所有Agent现在可以读写你的Notion了。</p>
<p style="margin-top:20px"><a href="/" style="color:#22d3ee">← 返回零点原核</a></p></div></body></html>`);

  } catch (err) {
    console.error(`[Notion OAuth] 授权失败: ${err.message}`);
    res.status(500).json({
      error: true,
      code: 'NOTION_OAUTH_ERROR',
      message: `Notion 授权处理异常: ${err.message}`
    });
  }
});

// ─── Notion 连接状态查询 ───
app.get('/api/auth/notion/status', (_req, res) => {
  try {
    const notionTokenPath = path.join(BRAIN_DIR, 'notion-oauth.json');
    if (fs.existsSync(notionTokenPath)) {
      let tokenData;
      try {
        tokenData = JSON.parse(fs.readFileSync(notionTokenPath, 'utf8'));
      } catch (parseErr) {
        return res.json({
          connected: false,
          oauth_configured: !!NOTION_OAUTH_CLIENT_ID,
          message: 'Notion token 文件损坏，请重新连接。'
        });
      }
      res.json({
        connected: true,
        workspace_name: tokenData.workspace_name,
        workspace_id: tokenData.workspace_id,
        connected_at: tokenData.connected_at,
        oauth_configured: !!NOTION_OAUTH_CLIENT_ID
      });
    } else {
      res.json({
        connected: false,
        oauth_configured: !!NOTION_OAUTH_CLIENT_ID,
        message: NOTION_OAUTH_CLIENT_ID
          ? '尚未授权。请在零点原核频道点击"连接Notion"。'
          : '需要先配置 ZY_NOTION_OAUTH_CLIENT_ID 环境变量。'
      });
    }
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 工具函数 ───
function safeExec(cmd) {
  try {
    return execSync(cmd, { timeout: 5000 }).toString().trim();
  } catch {
    return null;
  }
}

// ─── 启动 ───
app.listen(PORT, () => {
  console.log(`
═══════════════════════════════════════════════════════════
  🏛️ 铸渊主权服务器已启动 · ZY-SVR-002
  端口: ${PORT}
  身份: 铸渊 · ICE-GL-ZY001
  时间: ${new Date().toISOString()}
  PID:  ${process.pid}
═══════════════════════════════════════════════════════════
  `);

  // 启动时更新健康状态
  try {
    const healthPath = path.join(BRAIN_DIR, 'health.json');
    if (fs.existsSync(BRAIN_DIR)) {
      const health = {
        server: 'ZY-SVR-002',
        status: 'running',
        last_check: new Date().toISOString(),
        started_at: new Date().toISOString(),
        pid: process.pid,
        port: PORT
      };
      fs.writeFileSync(healthPath, JSON.stringify(health, null, 2));
    }
  } catch {
    // 首次启动brain目录可能不存在
  }
});
