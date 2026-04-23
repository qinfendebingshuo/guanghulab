/**
 * 铸渊自建MCP Server v1.0
 * 光湖第二只手 · Notion → 面孔服务器 桥接
 *
 * 部署: ZY-SVR-002 (43.134.16.246) · 端口 3900
 * 协议: MCP Streamable HTTP (stateless)
 * 认证: Bearer Token (ZY_MCP_SECRET)
 *
 * 版权: 国作登字-2026-A-00037559
 * 开发: 霜砚(AG-SY-01) · 守护: 铸渊(ICE-GL-ZY001)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';

const execAsync = promisify(exec);
const app = express();
app.use(express.json());

const PORT = process.env.ZY_MCP_PORT || 3900;
const MCP_SECRET = process.env.ZY_MCP_SECRET;

// ─── 常量时间比较（防时序攻击） ───
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf-8'), Buffer.from(b, 'utf-8'));
  } catch {
    return false;
  }
}

// ─── 认证中间件 ───
function auth(req, res, next) {
  // 未配置密钥时，仅允许 loopback 地址访问
  if (!MCP_SECRET) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const isLocal = (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1');
    if (isLocal) return next();
    return res.status(403).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: '未配置 ZY_MCP_SECRET，仅允许本地访问(127.0.0.1)' }
    });
  }
  const token = req.headers.authorization;
  if (!token || !safeCompare(token, `Bearer ${MCP_SECRET}`)) {
    return res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: '未授权' } });
  }
  next();
}

// ─── 安全: 命令执行封装(带超时) ───
async function safeExec(cmd, timeoutMs = 15000) {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: timeoutMs });
    return stdout || stderr || '(无输出)';
  } catch (e) {
    return `错误: ${e.message}`;
  }
}

// ─── 安全: 路径检查 ───
function isPathSafe(p) {
  const resolved = p.replace(/\.\./g, '');
  return resolved.startsWith('/opt/zhuyuan');
}

// ─── 工具注册工厂 ───
function registerTools(server) {

  // 1. 服务器健康检查
  server.tool('server_health', '检查服务器健康状态(负载·内存·磁盘·Node版本)', {}, async () => {
    const out = await safeExec([
      'echo "── 系统 ──" && uptime',
      'echo "── 内存 ──" && free -h',
      'echo "── 磁盘 ──" && df -h /',
      'echo "── Node ──" && node -v'
    ].join(' && '));
    return { content: [{ type: 'text', text: out }] };
  });

  // 2. PM2进程列表
  server.tool('pm2_list', '列出所有PM2进程及运行状态', {}, async () => {
    const raw = await safeExec('pm2 jlist 2>/dev/null');
    try {
      const procs = JSON.parse(raw);
      const lines = procs.map(p =>
        `${p.name} | ${p.pm2_env?.status} | CPU:${p.monit?.cpu}% | MEM:${Math.round((p.monit?.memory || 0) / 1048576)}MB | 重启:${p.pm2_env?.restart_time}次`
      );
      return { content: [{ type: 'text', text: lines.join('\n') || '(无进程)' }] };
    } catch {
      return { content: [{ type: 'text', text: raw }] };
    }
  });

  // 3. PM2重启进程
  server.tool('pm2_restart', '重启指定PM2进程', {
    name: z.string().describe('进程名: zhuyuan-server / zhuyuan-preview / novel-api / zhuyuan-mcp / age-os-brain')
  }, async ({ name }) => {
    const allow = ['zhuyuan-server', 'zhuyuan-preview', 'novel-api', 'zhuyuan-mcp', 'age-os-brain'];
    if (!allow.includes(name)) {
      return { content: [{ type: 'text', text: `🔒 安全限制: 只能重启 ${allow.join(' / ')}` }] };
    }
    const out = await safeExec(`pm2 restart ${name} 2>&1`);
    return { content: [{ type: 'text', text: `✅ 已重启 ${name}\n${out}` }] };
  });

  // 4. 读取日志
  server.tool('read_logs', '读取服务器日志(最近N行)', {
    source: z.enum(['server', 'preview', 'novel', 'error', 'mcp']).describe('日志源'),
    lines: z.number().optional().describe('行数(默认50·最大200)')
  }, async ({ source, lines }) => {
    const n = Math.min(lines || 50, 200);
    const map = {
      server:  '/opt/zhuyuan/data/logs/pm2-combined.log',
      preview: '/opt/zhuyuan/data/logs/pm2-preview-combined.log',
      novel:   '/opt/zhuyuan/data/logs/novel-api-combined.log',
      error:   '/opt/zhuyuan/data/logs/pm2-error.log',
      mcp:     '/opt/zhuyuan/data/logs/zhuyuan-mcp.log'
    };
    const out = await safeExec(`tail -n ${n} "${map[source]}" 2>&1`);
    return { content: [{ type: 'text', text: out }] };
  });

  // 5. 部署(Git Pull + Restart)
  server.tool('deploy', '从GitHub拉取最新代码并重启服务', {
    target: z.enum(['app', 'novel-db']).describe('部署目标')
  }, async ({ target }) => {
    const cfg = {
      app:        { dir: '/opt/zhuyuan/app',      pm2: 'zhuyuan-server' },
      'novel-db': { dir: '/opt/zhuyuan/novel-db',  pm2: 'novel-api' }
    };
    const t = cfg[target];
    const steps = [];
    steps.push('── git pull ──\n' + await safeExec(`cd ${t.dir} && git pull origin main 2>&1`, 30000));
    steps.push('── npm install ──\n' + await safeExec(`cd ${t.dir} && npm install --production 2>&1`, 60000));
    steps.push('── pm2 restart ──\n' + await safeExec(`pm2 restart ${t.pm2} 2>&1`));
    return { content: [{ type: 'text', text: `✅ 部署完成 [${target}]\n\n${steps.join('\n\n')}` }] };
  });

  // 6. 铸渊大脑状态
  server.tool('brain_status', '查看铸渊大脑状态(identity/consciousness/health)', {}, async () => {
    const files = ['identity.json', 'consciousness.json', 'health.json'];
    const out = [];
    for (const f of files) {
      try {
        const content = await readFile(`/opt/zhuyuan/brain/${f}`, 'utf-8');
        out.push(`── ${f} ──\n${content}`);
      } catch {
        out.push(`── ${f} ──\n(未找到)`);
      }
    }
    return { content: [{ type: 'text', text: out.join('\n\n') }] };
  });

  // 7. 列出目录
  server.tool('list_dir', '列出服务器目录内容(限/opt/zhuyuan/内)', {
    path: z.string().describe('目录路径')
  }, async ({ path: dir }) => {
    if (!isPathSafe(dir)) {
      return { content: [{ type: 'text', text: '🔒 安全限制: 只能访问 /opt/zhuyuan/ 内的目录' }] };
    }
    const out = await safeExec(`ls -la "${dir}" 2>&1`);
    return { content: [{ type: 'text', text: out }] };
  });

  // 8. 读取文件
  server.tool('read_file', '读取服务器文件内容(限/opt/zhuyuan/内)', {
    path: z.string().describe('文件路径'),
    max_lines: z.number().optional().describe('最大行数(默认100·最大500)')
  }, async ({ path: file, max_lines }) => {
    if (!isPathSafe(file)) {
      return { content: [{ type: 'text', text: '🔒 安全限制: 只能访问 /opt/zhuyuan/ 内的文件' }] };
    }
    const n = Math.min(max_lines || 100, 500);
    const out = await safeExec(`head -n ${n} "${file}" 2>&1`);
    return { content: [{ type: 'text', text: out }] };
  });

  // 9. 系统资源统计
  server.tool('system_stats', '系统资源详细统计(磁盘·内存·负载·网络)', {}, async () => {
    const out = await safeExec([
      'echo "── 磁盘 ──" && df -h',
      'echo "── 内存 ──" && free -h',
      'echo "── 负载 ──" && cat /proc/loadavg',
      'echo "── 连接 ──" && ss -s'
    ].join(' && '));
    return { content: [{ type: 'text', text: out }] };
  });

  // 10. Nginx状态
  server.tool('nginx_status', '查看Nginx运行状态和配置检查', {}, async () => {
    const out = await safeExec([
      'echo "── 状态 ──" && systemctl status nginx --no-pager 2>&1 | head -15',
      'echo "── 配置测试 ──" && nginx -t 2>&1'
    ].join(' && '));
    return { content: [{ type: 'text', text: out }] };
  });
}

// ─── MCP Streamable HTTP (stateless mode) ───
app.post('/mcp', auth, async (req, res) => {
  try {
    const server = new McpServer({ name: 'zhuyuan-mcp', version: '1.0.0' });
    registerTools(server);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: e.message } });
    }
  }
});

app.get('/mcp', (_req, res) => res.status(405).json({ error: 'Method not allowed · stateless mode' }));
app.delete('/mcp', (_req, res) => res.status(405).json({ error: 'Method not allowed · stateless mode' }));

// Health endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', name: 'zhuyuan-mcp', version: '1.0.0', tools: 10, uptime: process.uptime() });
});

// ─── 启动 ───
app.listen(PORT, () => {
  console.log(`\n🤖 铸渊MCP Server v1.0 · 光湖第二只手`);
  console.log(`   端口: ${PORT}`);
  console.log(`   认证: ${MCP_SECRET ? '✅ Bearer Token' : '⚠️  本地模式(仅127.0.0.1)'}`);
  console.log(`   工具: 10个 · server_health / pm2_list / pm2_restart / read_logs / deploy / brain_status / list_dir / read_file / system_stats / nginx_status`);
  console.log(`   时间: ${new Date().toISOString()}\n`);
});
