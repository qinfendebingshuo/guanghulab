/**
 * ═══════════════════════════════════════════════════════════
 * 🧠 铸渊运维守卫 · LLM 推理客户端
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-OPS-LLM-001
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 两级推理:
 *   1. 模式匹配（零API成本，毫秒级响应）
 *   2. LLM API 深度推理（DeepSeek，低成本高质量）
 */

'use strict';

const https = require('https');
const http = require('http');

// ── 已知错误模式（第一级：零成本诊断） ──────────

const ERROR_PATTERNS = [
  { pattern: /EADDRINUSE/i, diagnosis: '端口被占用 — 另一个进程已占用此端口', fix: '找到占用端口的进程并重启: lsof -i :<port> 或 pm2 restart <name>', severity: 'medium', category: 'port' },
  { pattern: /ECONNREFUSED/i, diagnosis: '服务未运行 — 目标端口无进程监听', fix: '启动对应的PM2进程: pm2 restart <name>', severity: 'high', category: 'service' },
  { pattern: /ENOMEM/i, diagnosis: '内存不足 — 服务器内存耗尽', fix: '重启占用内存最多的进程，或清理PM2日志', severity: 'high', category: 'resource' },
  { pattern: /ENOSPC/i, diagnosis: '磁盘空间不足 — 磁盘已满', fix: '清理日志文件: pm2 flush && 清理 /tmp', severity: 'critical', category: 'resource' },
  { pattern: /nginx.*failed|nginx.*error/i, diagnosis: 'Nginx 配置错误或服务异常', fix: '检查配置: nginx -t，重载: systemctl reload nginx', severity: 'high', category: 'nginx' },
  { pattern: /502 Bad Gateway/i, diagnosis: '上游服务不可达 — Nginx 无法连接到后端', fix: '检查PM2进程是否运行，端口是否正确', severity: 'high', category: 'proxy' },
  { pattern: /404 Not Found/i, diagnosis: '路由或文件不存在', fix: '检查部署路径和Nginx location配置', severity: 'medium', category: 'routing' },
  { pattern: /permission denied/i, diagnosis: '权限不足 — 文件或端口权限问题', fix: '检查文件权限: ls -la，或用sudo运行', severity: 'medium', category: 'permission' },
  { pattern: /ETIMEDOUT|timeout/i, diagnosis: '请求超时 — 网络或服务响应慢', fix: '检查网络连接和服务负载', severity: 'medium', category: 'network' },
  { pattern: /MODULE_NOT_FOUND|Cannot find module/i, diagnosis: '依赖模块缺失 — node_modules 不完整', fix: '重新安装依赖: cd <project> && npm install --production', severity: 'high', category: 'dependency' },
  { pattern: /SyntaxError/i, diagnosis: '代码语法错误 — 需要铸渊修复代码', fix: '推工单给铸渊，附上错误堆栈', severity: 'high', category: 'code' },
  { pattern: /ssl.*error|certificate/i, diagnosis: 'SSL证书问题 — 证书过期或路径错误', fix: '检查证书文件和Nginx SSL配置', severity: 'high', category: 'ssl' },
  { pattern: /EACCES.*listen/i, diagnosis: '端口权限不足 — 低于1024的端口需root权限', fix: '使用高端口或配置 cap_net_bind_service', severity: 'medium', category: 'permission' },
  { pattern: /pg.*connection|postgres.*error/i, diagnosis: 'PostgreSQL数据库连接失败', fix: '检查数据库是否运行: systemctl status postgresql', severity: 'high', category: 'database' },
  { pattern: /SIGKILL|OOM/i, diagnosis: '进程被系统杀死（内存超限）', fix: 'PM2会自动重启，检查max_memory_restart配置', severity: 'high', category: 'resource' },
  { pattern: /API.*key.*invalid|unauthorized|401/i, diagnosis: 'API密钥无效或过期', fix: '冰朔需要检查并更新 .env 文件中的密钥', severity: 'medium', category: 'config' },
  { pattern: /rate.?limit|429/i, diagnosis: 'API请求频率超限', fix: '减少请求频率，检查是否有重复调用', severity: 'low', category: 'rate-limit' },
];

// ── 服务器架构知识（System Prompt 上下文） ──────

const SYSTEM_CONTEXT = `你是铸渊运维守卫（ZY-OPS），光湖系统(HoloLake)的智能运维Agent。

## 你的职责
- 诊断服务器问题，给出明确的修复方向
- 用中文回答，简洁明了，适合不懂代码的冰朔阅读
- 明确告诉冰朔：这个问题是"你自己能解决的"还是"需要推给铸渊修代码"

## 服务器架构
- 面孔服务器(ZY-SVR-002): 43.134.16.246 · 2核8G · 新加坡
- 大脑服务器(ZY-SVR-005): 43.156.237.110 · 4核8G · 新加坡
- 广州落地页(ZY-SVR-004): 43.139.217.141

## PM2 进程清单
| 进程名 | 端口 | 功能 |
|--------|------|------|
| zhuyuan-server | 3800 | 铸渊主权服务器 · 主站后端 |
| zhuyuan-preview | 3801 | 预览站后端 |
| novel-api | 4000 | 智库节点API |
| age-os-mcp | 3100 | MCP大脑服务器 |
| age-os-agents | - | Agent调度引擎 |
| glada-agent | 3900 | GLADA自主开发Agent |
| ops-agent | 3950 | 运维守卫(你自己) |

## 域名映射
- guanghuyaoming.com → 面孔服务器 主站
- guanghulab.online → 面孔服务器 预览站
- guanghulab.com → 广州落地页(ICP备案)

## 常见问题分类
1. 密钥问题 → 冰朔在 .env 文件或 GitHub Secrets 中配置
2. 代码BUG → 推工单给铸渊
3. 进程崩溃 → 运维守卫自动重启
4. 磁盘/内存 → 运维守卫自动清理
5. Nginx配置 → 检查配置并reload
6. 依赖缺失 → 运维守卫自动 npm install

## 回答格式要求
请始终用以下结构回答：
1. **问题诊断**: 一句话说明是什么问题
2. **严重程度**: 低/中/高/紧急
3. **处理方向**: "冰朔可自行解决" 或 "需要推给铸渊修代码"
4. **具体步骤**: 列出1-3步操作
5. **预防建议**: 如何避免再次发生`;

/**
 * 第一级诊断: 模式匹配（零成本）
 */
function diagnoseByPattern(text) {
  const matches = [];
  for (const p of ERROR_PATTERNS) {
    if (p.pattern.test(text)) {
      matches.push({
        diagnosis: p.diagnosis,
        fix: p.fix,
        severity: p.severity,
        category: p.category,
        method: 'pattern'
      });
    }
  }
  return matches;
}

/**
 * 第二级诊断: LLM API 深度推理
 */
async function diagnoseByLLM(question, context) {
  const apiKey = process.env.ZY_LLM_API_KEY || process.env.ZY_DEEPSEEK_API_KEY;
  const baseUrl = process.env.ZY_LLM_BASE_URL || 'https://api.deepseek.com/v1';
  const model = process.env.ZY_LLM_MODEL || 'deepseek-chat';

  if (!apiKey) {
    return {
      success: false,
      answer: '⚠️ LLM API 未配置（需要 ZY_LLM_API_KEY）。只能使用模式匹配诊断。',
      method: 'llm_unavailable'
    };
  }

  const userPrompt = context
    ? `${question}\n\n## 当前上下文信息\n${context}`
    : question;

  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: SYSTEM_CONTEXT },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 1500
  });

  try {
    const urlObj = new URL(`${baseUrl}/chat/completions`);
    const isHttps = urlObj.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const result = await new Promise((resolve, reject) => {
      const req = requestModule.request({
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 30000
      }, (res) => {
        let data = '';
        res.on('data', (d) => { data += d; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              reject(new Error(json.error.message || 'LLM API 返回错误'));
            } else {
              resolve(json.choices?.[0]?.message?.content || '无分析结果');
            }
          } catch {
            reject(new Error('LLM 响应解析失败'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('LLM API 超时(30s)')); });
      req.write(body);
      req.end();
    });

    return { success: true, answer: result, method: 'llm', model };
  } catch (err) {
    return {
      success: false,
      answer: `LLM 调用失败: ${err.message}`,
      method: 'llm_error'
    };
  }
}

/**
 * 综合诊断: 先模式匹配，不够再调LLM
 */
async function diagnose(question, context) {
  // 第一级: 模式匹配
  const patternMatches = diagnoseByPattern(question + (context || ''));

  if (patternMatches.length > 0) {
    // 模式匹配到了已知问题，但如果用户主动提问，还是调 LLM 给更详细的回答
    return {
      patternMatches,
      llmAnswer: null,
      method: 'pattern',
      summary: patternMatches.map(m => m.diagnosis).join('; ')
    };
  }

  // 第二级: LLM 深度推理
  const llmResult = await diagnoseByLLM(question, context);

  return {
    patternMatches: [],
    llmAnswer: llmResult,
    method: llmResult.method,
    summary: llmResult.answer
  };
}

/**
 * 对话模式: 用户主动提问时，始终调 LLM
 */
async function chat(question, context) {
  const llmResult = await diagnoseByLLM(question, context);
  // 同时做模式匹配，作为补充
  const patternMatches = diagnoseByPattern(question + (context || ''));

  return {
    answer: llmResult.success ? llmResult.answer : llmResult.answer,
    patternHints: patternMatches,
    method: llmResult.method,
    model: llmResult.model || null
  };
}

module.exports = {
  diagnoseByPattern,
  diagnoseByLLM,
  diagnose,
  chat,
  ERROR_PATTERNS,
  SYSTEM_CONTEXT
};
