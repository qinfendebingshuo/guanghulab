/**
 * GMP-Agent MCP 工具集定义 + 实现
 * 工单编号: GH-GMP-004
 * 开发者: 译典A05 (5TH-LE-HK-A05)
 * 职责: 将 GMP-Agent 的核心功能暴露为 MCP 协议工具
 *
 * MCP 工具映射 (对齐 GMP-AGENT-SPEC v1.0 第5章):
 *   gmp.install        → 授权安装模块
 *   gmp.uninstall      → 卸载模块
 *   gmp.status         → 查看已安装模块清单
 *   gmp.health         → 全模块健康检查
 *   gmp.list_available → 列出仓库可用模块
 *
 * 接口约定:
 *   - 每个工具遵循 JSON-RPC 2.0 风格 (id, method, params → result/error)
 *   - inputSchema 兼容 MCP Tool 规范 (name, description, inputSchema)
 *   - 内部调用 GMPAgent 实例方法, 不直接操作文件系统
 */

'use strict';

const { createLogger } = require('./lib/logger');
const logger = createLogger('mcp-tools');

// ─── 工具定义 (MCP Tool Schema) ─────────────────────────

const TOOL_DEFINITIONS = [
  {
    name: 'gmp.install',
    description: '授权安装一个 GMP 模块到服务器。需要模块名称，可选指定仓库URL和分支。安装过程包括：克隆代码→验证manifest→安装依赖→自检→注册。',
    inputSchema: {
      type: 'object',
      properties: {
        moduleName: {
          type: 'string',
          description: '要安装的模块名称 (对应仓库中 guanghu-self-hosted/ 下的目录名)'
        },
        repoUrl: {
          type: 'string',
          description: '仓库克隆URL (可选, 默认使用配置中的 defaultRepoUrl)'
        },
        branch: {
          type: 'string',
          description: '分支名 (可选, 默认 main)'
        }
      },
      required: ['moduleName']
    }
  },
  {
    name: 'gmp.uninstall',
    description: '卸载一个已安装的 GMP 模块。停止进程→清理文件→从注册表移除。',
    inputSchema: {
      type: 'object',
      properties: {
        moduleName: {
          type: 'string',
          description: '要卸载的模块名称'
        }
      },
      required: ['moduleName']
    }
  },
  {
    name: 'gmp.status',
    description: '查看所有已安装 GMP 模块的清单和状态。返回模块名称、安装时间、运行状态等信息。',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'gmp.health',
    description: '执行全模块健康检查。检查每个已安装模块的进程状态和端口响应，返回详细健康报告。',
    inputSchema: {
      type: 'object',
      properties: {
        moduleName: {
          type: 'string',
          description: '指定单个模块名称进行检查 (可选, 不传则检查全部)'
        }
      },
      required: []
    }
  },
  {
    name: 'gmp.list_available',
    description: '列出仓库中所有可用的 GMP 模块 (尚未安装的)。扫描仓库 guanghu-self-hosted/ 目录下包含 manifest.yaml 的子目录。',
    inputSchema: {
      type: 'object',
      properties: {
        branch: {
          type: 'string',
          description: '要扫描的分支 (可选, 默认 main)'
        }
      },
      required: []
    }
  }
];

// ─── MCP 工具路由器 ─────────────────────────────────────

class MCPToolRouter {
  /**
   * @param {object} agent - GMPAgent 实例 (app.js 中的 GMPAgent)
   */
  constructor(agent) {
    this.agent = agent;
    this.handlers = new Map();
    this._registerHandlers();
  }

  /**
   * 注册所有工具处理器
   */
  _registerHandlers() {
    this.handlers.set('gmp.install', this._handleInstall.bind(this));
    this.handlers.set('gmp.uninstall', this._handleUninstall.bind(this));
    this.handlers.set('gmp.status', this._handleStatus.bind(this));
    this.handlers.set('gmp.health', this._handleHealth.bind(this));
    this.handlers.set('gmp.list_available', this._handleListAvailable.bind(this));
  }

  /**
   * 获取所有工具定义 (供 MCP listTools 使用)
   * @returns {Array<object>}
   */
  listTools() {
    return TOOL_DEFINITIONS;
  }

  /**
   * 执行工具调用 (供 MCP callTool 使用)
   * @param {string} toolName - 工具名称
   * @param {object} params - 工具参数
   * @returns {Promise<object>} 执行结果
   */
  async callTool(toolName, params = {}) {
    const handler = this.handlers.get(toolName);
    if (!handler) {
      return {
        error: {
          code: -32601,
          message: 'Tool not found: ' + toolName
        }
      };
    }

    const startTime = Date.now();
    logger.info('MCP tool call: ' + toolName, { params });

    try {
      const result = await handler(params);
      const duration = Date.now() - startTime;
      logger.info('MCP tool completed: ' + toolName + ' (' + duration + 'ms)');
      return { result, duration };
    } catch (err) {
      const duration = Date.now() - startTime;
      logger.error('MCP tool failed: ' + toolName + ' -> ' + err.message + ' (' + duration + 'ms)');
      return {
        error: {
          code: -32000,
          message: err.message
        },
        duration
      };
    }
  }

  // ─── 工具处理器 ───────────────────────────────────────

  /**
   * gmp.install — 安装模块
   */
  async _handleInstall(params) {
    const { moduleName, repoUrl, branch } = params;
    if (!moduleName) {
      throw new Error('缺少必填参数: moduleName');
    }

    // 检查是否已安装
    if (this.agent.installedModules.has(moduleName)) {
      throw new Error('模块已安装: ' + moduleName + '。如需更新请先卸载。');
    }

    const result = await this.agent.installer.install({
      repoUrl,
      moduleName,
      branch,
      autoTriggered: false
    });

    return {
      status: 'installed',
      module: moduleName,
      branch: result.branch,
      duration: result.duration,
      selfCheck: result.selfCheck,
      message: '模块 ' + moduleName + ' 安装成功'
    };
  }

  /**
   * gmp.uninstall — 卸载模块
   */
  async _handleUninstall(params) {
    const { moduleName } = params;
    if (!moduleName) {
      throw new Error('缺少必填参数: moduleName');
    }

    if (!this.agent.installedModules.has(moduleName)) {
      throw new Error('模块未安装: ' + moduleName);
    }

    const result = await this.agent.uninstaller.uninstall({ moduleName });

    return {
      status: 'uninstalled',
      module: moduleName,
      message: '模块 ' + moduleName + ' 已卸载'
    };
  }

  /**
   * gmp.status — 查看已安装模块清单
   */
  async _handleStatus() {
    const modules = [];
    for (const [name, info] of this.agent.installedModules) {
      modules.push({
        name: name,
        status: info.status,
        path: info.path,
        installedAt: info.installedAt,
        branch: info.branch || 'unknown',
        health: info.health || 'unknown',
        lastHealthCheck: info.lastHealthCheck || null
      });
    }

    return {
      agentStatus: this.agent.status,
      agentUptime: Math.floor((Date.now() - this.agent.startTime) / 1000),
      modulesCount: modules.length,
      modules: modules
    };
  }

  /**
   * gmp.health — 全模块健康检查
   */
  async _handleHealth(params) {
    const { moduleName } = params;

    // 如果指定了单个模块
    if (moduleName) {
      const info = this.agent.installedModules.get(moduleName);
      if (!info) {
        throw new Error('模块未安装: ' + moduleName);
      }
      const health = await this._checkSingleModuleHealth(moduleName, info);
      return { modules: [health] };
    }

    // 全模块检查
    const results = [];
    for (const [name, info] of this.agent.installedModules) {
      const health = await this._checkSingleModuleHealth(name, info);
      results.push(health);
    }

    const allOk = results.every(r => r.health === 'ok');

    return {
      overall: allOk ? 'healthy' : 'degraded',
      checkedAt: new Date().toISOString(),
      modulesChecked: results.length,
      modules: results
    };
  }

  /**
   * gmp.list_available — 列出仓库可用模块
   */
  async _handleListAvailable(params) {
    // 注意: 在生产环境中，这需要通过 GitHub API 或本地缓存扫描仓库
    // 当前实现: 扫描本地 modules 目录的 _available 缓存
    // 如果缓存不存在，返回提示信息
    const fs = require('fs');
    const path = require('path');

    const availableCachePath = path.join(this.agent.config.baseDir, 'available-modules.json');

    if (fs.existsSync(availableCachePath)) {
      try {
        const cache = JSON.parse(fs.readFileSync(availableCachePath, 'utf-8'));
        // 过滤掉已安装的
        const available = (cache.modules || []).filter(
          m => !this.agent.installedModules.has(m.name)
        );
        return {
          available: available,
          total: available.length,
          cachedAt: cache.updatedAt || 'unknown',
          note: '数据来自本地缓存，可能不是最新'
        };
      } catch (err) {
        logger.warn('读取可用模块缓存失败: ' + err.message);
      }
    }

    return {
      available: [],
      total: 0,
      note: '可用模块缓存不存在。请通过 GitHub API 扫描仓库或手动创建 available-modules.json'
    };
  }

  /**
   * 检查单个模块健康状态
   * @param {string} name - 模块名
   * @param {object} info - 模块信息
   * @returns {Promise<object>} 健康检查结果
   */
  async _checkSingleModuleHealth(name, info) {
    const result = {
      name: name,
      health: 'unknown',
      checkedAt: new Date().toISOString(),
      details: {}
    };

    try {
      // 检查1: 模块目录是否存在
      const fs = require('fs');
      if (!fs.existsSync(info.path)) {
        result.health = 'fail';
        result.details.error = '模块目录不存在: ' + info.path;
        return result;
      }

      // 检查2: manifest.yaml 是否存在
      const path = require('path');
      const manifestPath = path.join(info.path, 'manifest.yaml');
      result.details.manifestExists = fs.existsSync(manifestPath);

      // 检查3: 如果模块有端口配置，尝试 HTTP 健康检查
      if (info.port) {
        try {
          const http = require('http');
          const healthOk = await new Promise((resolve) => {
            const req = http.get(
              'http://127.0.0.1:' + info.port + '/health',
              { timeout: 5000 },
              (res) => resolve(res.statusCode >= 200 && res.statusCode < 400)
            );
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
          });
          result.details.httpHealth = healthOk;
        } catch {
          result.details.httpHealth = false;
        }
      }

      // 综合判定
      result.health = 'ok';
      if (info.port && result.details.httpHealth === false) {
        result.health = 'degraded';
      }

    } catch (err) {
      result.health = 'fail';
      result.details.error = err.message;
    }

    return result;
  }
}

// ─── Express 路由注册 ───────────────────────────────────

/**
 * 注册 MCP 工具相关的 Express 路由
 * @param {object} app - Express app
 * @param {MCPToolRouter} router - MCP 工具路由器
 */
function registerMCPRoutes(app, router) {
  // MCP listTools — 列出所有可用工具
  app.get('/mcp/tools', (req, res) => {
    res.json({
      tools: router.listTools(),
      total: router.listTools().length,
      protocol: 'MCP/1.0'
    });
  });

  // MCP callTool — 执行工具调用 (JSON-RPC 2.0 风格)
  app.post('/mcp/call', async (req, res) => {
    const { id, method, params } = req.body;

    if (!method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: id || null,
        error: { code: -32600, message: '缺少 method 参数' }
      });
    }

    const result = await router.callTool(method, params || {});

    if (result.error) {
      return res.status(result.error.code === -32601 ? 404 : 500).json({
        jsonrpc: '2.0',
        id: id || null,
        error: result.error
      });
    }

    res.json({
      jsonrpc: '2.0',
      id: id || null,
      result: result.result,
      meta: { duration: result.duration }
    });
  });

  logger.info('MCP 工具路由已注册: /mcp/tools, /mcp/call');
}

// ─── 导出 ──────────────────────────────────────────────

module.exports = {
  MCPToolRouter,
  TOOL_DEFINITIONS,
  registerMCPRoutes
};
