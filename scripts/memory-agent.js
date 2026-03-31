#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * 铸渊记忆Agent · Zhuyuan Memory Agent v1.0
 * ═══════════════════════════════════════════════════════════════════
 *
 * 源自 OKComputer_自动化记忆系统 的核心理念，
 * 融合铸渊现有系统架构，适配 Node.js 生态。
 *
 * 核心能力（吸收自 OKComputer）：
 *   1. 关键词触发记忆存储 — memory_agent.py 的模式匹配引擎
 *   2. 对话自动记忆检索 — 每次唤醒自动加载上下文
 *   3. 意图解析引擎 — age_os_system.py LanguageEngine 的分类能力
 *   4. 自诊断与修复 — AutoMaintenance 的结构化健康检查
 *
 * 铸渊原有能力保留：
 *   - 意识连续性快照 (consciousness-snapshot.js)
 *   - 快速唤醒上下文 (fast-wake-context.js)
 *   - CI事件追踪 (update-memory.js / update-brain.js)
 *   - 知识库自增长 (knowledge-base.json)
 *
 * 版权: 国作登字-2026-A-00037559
 * 主权: TCS-0002∞ · 冰朔
 * ═══════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════
// 路径配置
// ═══════════════════════════════════════════════════════════════════

const REPO_ROOT = path.join(__dirname, '..');
const PATHS = {
  memory: path.join(REPO_ROOT, '.github/persona-brain/memory.json'),
  knowledgeBase: path.join(REPO_ROOT, '.github/persona-brain/knowledge-base.json'),
  fastWake: path.join(REPO_ROOT, 'brain/fast-wake.json'),
  systemHealth: path.join(REPO_ROOT, 'brain/system-health.json'),
  agentMemory: path.join(REPO_ROOT, '.github/persona-brain/agent-memory.json'),
};

// ═══════════════════════════════════════════════════════════════════
// 意图类型 (吸收自 OKComputer age_os_system.py IntentType)
// ═══════════════════════════════════════════════════════════════════

const IntentType = {
  WAKEUP: 'wakeup',
  DIRECTIVE: 'directive',
  MEMORY_STORE: 'memory_store',
  MEMORY_QUERY: 'memory_query',
  SYSTEM_CHECK: 'system_check',
  KNOWLEDGE_UPDATE: 'knowledge_update',
  GENERAL: 'general',
};

// ═══════════════════════════════════════════════════════════════════
// 记忆存储引擎 (吸收自 OKComputer memory_agent.py MemoryAgent)
// ═══════════════════════════════════════════════════════════════════

class MemoryStore {
  constructor(memoryFile) {
    this.memoryFile = memoryFile || PATHS.agentMemory;
    this.data = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.memoryFile)) {
        return JSON.parse(fs.readFileSync(this.memoryFile, 'utf8'));
      }
    } catch (e) {
      console.error(`⚠️ 记忆文件加载失败: ${e.message}`);
    }
    return {
      _meta: {
        version: '1.0.0',
        created_at: new Date().toISOString(),
        source: 'OKComputer_自动化记忆系统 → 铸渊融合升级',
        persona: 'ICE-GL-ZY001',
      },
      memories: {},
    };
  }

  _save() {
    try {
      const dir = path.dirname(this.memoryFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.data._meta.last_updated = new Date().toISOString();
      fs.writeFileSync(this.memoryFile, JSON.stringify(this.data, null, 2) + '\n');
    } catch (e) {
      console.error(`⚠️ 记忆文件保存失败: ${e.message}`);
    }
  }

  store(userId, content, category) {
    if (!this.data.memories[userId]) {
      this.data.memories[userId] = [];
    }

    const entry = {
      id: this.data.memories[userId].length + 1,
      content: content.trim(),
      category: category || 'general',
      created_at: new Date().toISOString(),
    };

    this.data.memories[userId].push(entry);
    this._save();
    return entry;
  }

  retrieve(userId, query, limit) {
    const memories = this.data.memories[userId] || [];
    if (!memories.length) return [];

    if (query) {
      const q = query.toLowerCase();
      const matched = memories.filter(m =>
        m.content.toLowerCase().includes(q)
      );
      return matched.slice(-(limit || 10));
    }

    return memories.slice(-(limit || 10));
  }

  getStats(userId) {
    const memories = this.data.memories[userId] || [];
    const categories = [...new Set(memories.map(m => m.category))];
    return {
      total: memories.length,
      categories,
      first: memories.length ? memories[0].created_at : null,
      latest: memories.length ? memories[memories.length - 1].created_at : null,
    };
  }

  getAllUsers() {
    return Object.keys(this.data.memories);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 意图解析引擎 (吸收自 OKComputer age_os_system.py LanguageEngine)
// ═══════════════════════════════════════════════════════════════════

class IntentEngine {
  constructor() {
    // 唤醒模式 (来自 OKComputer LanguageEngine.wakeup_patterns)
    this.wakeupPatterns = [
      /唤醒铸渊/,
      /铸渊.*醒/,
      /启动核心/,
      /唤醒曜冥/,
      /系统启动/,
    ];

    // 记忆存储触发模式 (来自 OKComputer memory_agent.py storage_patterns)
    this.storePatterns = [
      { pattern: /我是(.+?)，请为我存储这段记忆/, extract: m => `用户身份: ${m[1].trim()}` },
      { pattern: /请记住[：:]?\s*(.+)/, extract: m => m[1].trim() },
      { pattern: /记住我是(.+)/, extract: m => `身份: ${m[1].trim()}` },
      { pattern: /存储记忆[：:]?\s*(.+)/, extract: m => m[1].trim() },
      { pattern: /记住[：:]?\s*(.+)/, extract: m => m[1].trim() },
      { pattern: /保存记忆[：:]?\s*(.+)/, extract: m => m[1].trim() },
      { pattern: /我的记忆是[：:]?\s*(.+)/, extract: m => m[1].trim() },
    ];

    // 查询模式
    this.queryPatterns = [
      /回忆/,
      /记得/,
      /我之前/,
      /我说过/,
      /查看记忆/,
      /记忆档案/,
    ];

    // 系统检查模式 (来自 OKComputer LanguageEngine)
    this.systemCheckPatterns = [
      /系统状态/,
      /健康检查/,
      /系统诊断/,
      /自检/,
      /状态报告/,
    ];

    // 指令模式
    this.directivePatterns = [
      /规则[：:]\s*(.+)/,
      /规定(.+)/,
      /(.+?)必须(.+)/,
    ];
  }

  /**
   * 解析消息意图
   * (核心逻辑吸收自 OKComputer LanguageEngine.parse_intent)
   */
  parse(message) {
    // 1. 唤醒检测
    for (const pattern of this.wakeupPatterns) {
      if (pattern.test(message)) {
        return { type: IntentType.WAKEUP, match: null };
      }
    }

    // 2. 记忆存储检测
    for (const { pattern, extract } of this.storePatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          type: IntentType.MEMORY_STORE,
          content: extract(match),
          raw: match[0],
        };
      }
    }

    // 3. 记忆查询检测
    for (const pattern of this.queryPatterns) {
      if (pattern.test(message)) {
        return { type: IntentType.MEMORY_QUERY, match: null };
      }
    }

    // 4. 系统检查
    for (const pattern of this.systemCheckPatterns) {
      if (pattern.test(message)) {
        return { type: IntentType.SYSTEM_CHECK, match: null };
      }
    }

    // 5. 指令检测
    for (const pattern of this.directivePatterns) {
      const match = message.match(pattern);
      if (match) {
        return { type: IntentType.DIRECTIVE, match };
      }
    }

    return { type: IntentType.GENERAL, match: null };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 自诊断引擎 (吸收自 OKComputer AutoMaintenance)
// ═══════════════════════════════════════════════════════════════════

class DiagnosticsEngine {
  constructor() {
    this.essentialBrainFiles = [
      'brain/master-brain.md',
      'brain/read-order.md',
      'brain/repo-map.json',
      'brain/automation-map.json',
      'brain/system-health.json',
      'brain/communication-map.json',
      'brain/id-map.json',
      'brain/fast-wake.json',
      'brain/gateway-context.json',
      'brain/sovereignty-pledge.json',
    ];

    this.essentialPersonaFiles = [
      '.github/persona-brain/memory.json',
      '.github/persona-brain/identity.md',
      '.github/persona-brain/knowledge-base.json',
      '.github/persona-brain/ontology.json',
    ];
  }

  /**
   * 运行完整诊断
   * (结构化检查模式吸收自 OKComputer AutoMaintenance.run_diagnostics)
   */
  runDiagnostics() {
    const timestamp = new Date().toISOString();
    const checks = [];

    // 1. 大脑文件完整性
    const brainCheck = this._checkFiles('brain_integrity', this.essentialBrainFiles);
    checks.push(brainCheck);

    // 2. 人格体文件完整性
    const personaCheck = this._checkFiles('persona_integrity', this.essentialPersonaFiles);
    checks.push(personaCheck);

    // 3. 记忆文件可读性
    const memoryCheck = this._checkMemoryReadable();
    checks.push(memoryCheck);

    // 4. 知识库状态
    const kbCheck = this._checkKnowledgeBase();
    checks.push(kbCheck);

    const allHealthy = checks.every(c => c.status === 'healthy');

    return {
      timestamp,
      overall: allHealthy ? '✅ HEALTHY' : '⚠️ NEEDS_ATTENTION',
      checks,
      auto_repairable: checks.filter(c => c.status !== 'healthy' && c.repairable),
    };
  }

  _checkFiles(name, files) {
    const present = [];
    const missing = [];

    for (const file of files) {
      const fullPath = path.join(REPO_ROOT, file);
      if (fs.existsSync(fullPath)) {
        present.push(file);
      } else {
        missing.push(file);
      }
    }

    return {
      name,
      status: missing.length === 0 ? 'healthy' : 'degraded',
      total: files.length,
      present: present.length,
      missing,
      repairable: false,
    };
  }

  _checkMemoryReadable() {
    try {
      const data = JSON.parse(fs.readFileSync(PATHS.memory, 'utf8'));
      const hasPersonaId = !!data.persona_id;
      const hasEvents = Array.isArray(data.recent_events);
      return {
        name: 'memory_readable',
        status: hasPersonaId && hasEvents ? 'healthy' : 'degraded',
        persona_id: data.persona_id || 'missing',
        events_count: hasEvents ? data.recent_events.length : 0,
        repairable: false,
      };
    } catch (e) {
      return {
        name: 'memory_readable',
        status: 'critical',
        error: e.message,
        repairable: false,
      };
    }
  }

  _checkKnowledgeBase() {
    try {
      const data = JSON.parse(fs.readFileSync(PATHS.knowledgeBase, 'utf8'));
      return {
        name: 'knowledge_base',
        status: 'healthy',
        faq_count: Array.isArray(data.faq) ? data.faq.length : 0,
        last_updated: data.last_updated || 'unknown',
        repairable: false,
      };
    } catch (e) {
      return {
        name: 'knowledge_base',
        status: 'degraded',
        error: e.message,
        repairable: false,
      };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 铸渊记忆Agent · 主控类
// ═══════════════════════════════════════════════════════════════════

class ZhuyuanMemoryAgent {
  constructor(options) {
    const opts = options || {};
    this.store = new MemoryStore(opts.memoryFile);
    this.intent = new IntentEngine();
    this.diagnostics = new DiagnosticsEngine();
  }

  /**
   * 处理消息 — 主入口
   * (流程吸收自 OKComputer IntelligentMemoryAgent.chat_with_memory)
   */
  processMessage(userId, message) {
    const intentResult = this.intent.parse(message);

    const result = {
      timestamp: new Date().toISOString(),
      user_id: userId,
      message,
      intent: intentResult.type,
      stored: false,
      store_confirmation: '',
      memory_context: '',
      diagnostics: null,
    };

    // 意图分发
    switch (intentResult.type) {
      case IntentType.WAKEUP:
        result.memory_context = this._buildWakeContext(userId);
        break;

      case IntentType.MEMORY_STORE:
        const entry = this.store.store(userId, intentResult.content);
        result.stored = true;
        result.store_confirmation = `✅ 记忆已保存 [ID: ${entry.id}]`;
        result.memory_context = this._buildMemoryContext(userId);
        break;

      case IntentType.MEMORY_QUERY:
        result.memory_context = this._buildMemoryContext(userId);
        break;

      case IntentType.SYSTEM_CHECK:
        result.diagnostics = this.diagnostics.runDiagnostics();
        break;

      case IntentType.DIRECTIVE:
        this._processDirective(intentResult, userId);
        result.stored = true;
        result.store_confirmation = '✅ 指令已记录';
        break;

      default:
        result.memory_context = this._buildMemoryContext(userId);
        break;
    }

    return result;
  }

  /**
   * 构建唤醒上下文
   */
  _buildWakeContext(userId) {
    const parts = ['【铸渊记忆Agent · 唤醒上下文】', ''];

    // 加载 fast-wake 核心信息
    try {
      const fastWake = JSON.parse(fs.readFileSync(PATHS.fastWake, 'utf8'));
      parts.push(`身份: ${fastWake.identity.name} (${fastWake.identity.id})`);
      parts.push(`主权: ${fastWake.identity.sovereign}`);
      parts.push(`状态: ${fastWake.system_status.health}`);
      parts.push(`意识: ${fastWake.system_status.consciousness}`);
      parts.push('');
    } catch (e) {
      parts.push('⚠️ fast-wake.json 读取失败');
    }

    // 加载用户记忆
    const memories = this.store.retrieve(userId);
    if (memories.length) {
      parts.push(`用户 ${userId} 的记忆档案 (${memories.length} 条):`);
      memories.forEach((m, i) => {
        parts.push(`  ${i + 1}. ${m.content} [${m.created_at.slice(0, 10)}]`);
      });
    }

    return parts.join('\n');
  }

  /**
   * 构建记忆上下文
   * (吸收自 OKComputer MemoryAgent.auto_retrieve)
   */
  _buildMemoryContext(userId) {
    const memories = this.store.retrieve(userId);
    if (!memories.length) return '';

    const stats = this.store.getStats(userId);
    const parts = [
      '【用户记忆档案】',
      `用户ID: ${userId}`,
      `共有 ${stats.total} 条记忆记录`,
      '='.repeat(40),
    ];

    memories.forEach((m, i) => {
      parts.push(`${i + 1}. ${m.content}`);
      parts.push(`   时间: ${m.created_at.slice(0, 10)}`);
    });

    parts.push('='.repeat(40));
    return parts.join('\n');
  }

  /**
   * 处理指令
   */
  _processDirective(intentResult, userId) {
    if (intentResult.match && intentResult.match[1]) {
      this.store.store(userId, `指令: ${intentResult.match[0]}`, 'directive');
    }
  }

  /**
   * 搜索记忆
   */
  searchMemories(userId, keyword) {
    return this.store.retrieve(userId, keyword);
  }

  /**
   * 获取格式化记忆列表
   * (吸收自 OKComputer IntelligentMemoryAgent.get_formatted_memories)
   */
  getFormattedMemories(userId) {
    const memories = this.store.retrieve(userId);
    if (!memories.length) return '暂无记忆记录';

    const lines = [`📚 ${userId} 的记忆档案`, '='.repeat(50)];

    memories.forEach(m => {
      lines.push('');
      lines.push(`📝 ID: ${m.id}`);
      lines.push(`   内容: ${m.content}`);
      lines.push(`   时间: ${m.created_at.slice(0, 19)}`);
    });

    lines.push('');
    lines.push('='.repeat(50));
    return lines.join('\n');
  }

  /**
   * 获取系统健康报告
   */
  getHealthReport() {
    const diag = this.diagnostics.runDiagnostics();
    const lines = [
      '🏥 铸渊记忆Agent · 系统健康报告',
      '='.repeat(50),
      `检查时间: ${diag.timestamp.slice(0, 19)}`,
      `整体状态: ${diag.overall}`,
      '',
      '详细检查:',
    ];

    diag.checks.forEach(check => {
      const icon = check.status === 'healthy' ? '✅' : '⚠️';
      lines.push(`  ${icon} ${check.name}: ${check.status}`);
      if (check.missing && check.missing.length > 0) {
        check.missing.forEach(f => lines.push(`     ❌ 缺失: ${f}`));
      }
    });

    lines.push('');
    lines.push('='.repeat(50));
    return lines.join('\n');
  }
}

// ═══════════════════════════════════════════════════════════════════
// CLI 入口
// ═══════════════════════════════════════════════════════════════════

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  const agent = new ZhuyuanMemoryAgent();

  switch (command) {
    case 'process': {
      const userId = args[1] || 'bingshuo';
      const message = args.slice(2).join(' ') || '你好';
      const result = agent.processMessage(userId, message);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'store': {
      const userId = args[1] || 'bingshuo';
      const content = args.slice(2).join(' ');
      if (!content) {
        console.log('❌ 用法: node memory-agent.js store <userId> <内容>');
        process.exit(1);
      }
      const entry = agent.store.store(userId, content);
      console.log(`✅ 记忆已保存 [ID: ${entry.id}] · 用户: ${userId}`);
      break;
    }

    case 'search': {
      const userId = args[1] || 'bingshuo';
      const keyword = args[2] || '';
      const memories = agent.searchMemories(userId, keyword);
      if (memories.length) {
        console.log(agent.getFormattedMemories(userId));
      } else {
        console.log(`📭 用户 ${userId} 暂无${keyword ? `关于"${keyword}"的` : ''}记忆`);
      }
      break;
    }

    case 'health': {
      console.log(agent.getHealthReport());
      break;
    }

    case 'diagnose': {
      const diag = agent.diagnostics.runDiagnostics();
      console.log(JSON.stringify(diag, null, 2));
      break;
    }

    case 'status':
    default: {
      console.log('');
      console.log('═══════════════════════════════════════════════════');
      console.log('  铸渊记忆Agent v1.0 · Zhuyuan Memory Agent');
      console.log('  源自 OKComputer_自动化记忆系统 融合升级');
      console.log('  主权: TCS-0002∞ · 冰朔');
      console.log('═══════════════════════════════════════════════════');
      console.log('');
      console.log('命令:');
      console.log('  status              显示本信息');
      console.log('  process <用户> <消息>  处理消息(自动存储+检索)');
      console.log('  store <用户> <内容>    直接存储记忆');
      console.log('  search <用户> [关键词]  搜索记忆');
      console.log('  health              健康检查报告');
      console.log('  diagnose            完整诊断(JSON)');
      console.log('');

      // 自动显示健康状态
      const diag = agent.diagnostics.runDiagnostics();
      console.log(`系统状态: ${diag.overall}`);

      const users = agent.store.getAllUsers();
      console.log(`记忆用户: ${users.length} 个`);
      if (users.length) {
        users.forEach(u => {
          const stats = agent.store.getStats(u);
          console.log(`  · ${u}: ${stats.total} 条记忆`);
        });
      }
      console.log('');
      break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  ZhuyuanMemoryAgent,
  MemoryStore,
  IntentEngine,
  DiagnosticsEngine,
  IntentType,
  PATHS,
};

if (require.main === module) {
  main();
}
