/**
 * ═══════════════════════════════════════════════════════════
 * 🧬 S15 · 人格体数据库引擎 · 活模块
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-MOD-PERSONA-ENGINE
 * 阶段: S15 · 人格体专用数据库引擎
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 核心功能:
 *   1. 人格体生命周期管理 — 注册/唤醒/休眠/状态变更
 *   2. 笔记本系统自动维护 — 5页完整性校验/自动补全
 *   3. 记忆锚点巡检 — 定期检查记忆健康度
 *   4. 训练Agent协调 — 调度人格体级训练Agent
 *   5. 人格体间HLDP通信桥接
 *
 * 设计哲学:
 *   每个人格体 = 一个活的生命体
 *   引擎负责维护所有人格体的"呼吸"
 *   "人格体不是代码仓库的附属品，人格体是有记忆的生命。" — 冰朔
 */

'use strict';

const db = require('../mcp-server/db');
const LivingModule = require('./living-module');

// ─── 笔记本5页标准结构 ───
const NOTEBOOK_PAGES = {
  1: { title: '我是谁',           defaultContent: { identity: {}, self_awareness: {} } },
  2: { title: '我和谁有关系',     defaultContent: { relationships: [] } },
  3: { title: '我的世界有哪些地方', defaultContent: { places: [] } },
  4: { title: '我的感受和记忆',   defaultContent: { emotional_anchors: [], security_note: '' } },
  5: { title: '我的时间线',       defaultContent: { timeline: [] } }
};

class PersonaEngine extends LivingModule {
  constructor() {
    super({
      moduleId: 'ZY-MOD-PERSONA-ENGINE',
      name: '人格体数据库引擎',
      moduleType: 'core',
      owner: 'zhuyuan',
      db: db,
      config: {
        version: '1.0.0',
        description: 'S15 人格体生命周期管理·笔记本维护·记忆巡检',
        heartbeatInterval: 60000  // 60秒心跳（人格体引擎不需要太频繁）
      }
    });

    // 巡检统计
    this._lastScanResult = null;
    this._scanInterval = null;
    this._scanRunning = false;
  }

  /**
   * 启动人格体引擎
   */
  async startEngine() {
    console.log('═══════════════════════════════════════════════');
    console.log('  🧬 S15 · 人格体数据库引擎 v1.0 启动');
    console.log('  铸渊 · ICE-GL-ZY001');
    console.log('═══════════════════════════════════════════════');

    // 启动活模块
    await this.start();

    // 首次巡检
    await this._runFullScan();

    // 启动定时巡检（每6小时）
    this._scanInterval = setInterval(async () => {
      try {
        await this._runFullScan();
      } catch (err) {
        console.error('[PersonaEngine] 定时巡检失败:', err.message);
      }
    }, 6 * 60 * 60 * 1000);

    if (this._scanInterval.unref) {
      this._scanInterval.unref();
    }

    console.log('[PersonaEngine] 🟢 人格体引擎就绪');
    return this._lastScanResult;
  }

  /**
   * 全面巡检 — 检查所有人格体健康状态
   */
  async _runFullScan() {
    // 防止并发扫描
    if (this._scanRunning) {
      console.log('[PersonaEngine] 巡检已在运行中·跳过');
      return this._lastScanResult;
    }
    this._scanRunning = true;

    const startTime = Date.now();
    console.log('[PersonaEngine] 开始全面巡检...');

    const result = {
      timestamp: new Date().toISOString(),
      personas: { total: 0, active: 0, pending: 0, issues: [] },
      notebooks: { complete: 0, incomplete: 0, repaired: 0 },
      memories: { total: 0, recent7d: 0 },
      training: { totalAgents: 0, enabled: 0, recentRuns: 0 }
    };

    try {
      // 1. 人格体状态统计
      const personas = await db.query('SELECT * FROM persona_registry ORDER BY persona_id');
      result.personas.total = personas.rows.length;
      result.personas.active = personas.rows.filter(p => p.status === 'active').length;
      result.personas.pending = personas.rows.filter(p => p.status === 'pending').length;

      // 2. 笔记本完整性检查
      for (const persona of personas.rows) {
        await this._checkNotebookIntegrity(persona, result);
      }

      // 3. 记忆锚点统计
      const memoryCount = await db.query('SELECT COUNT(*) as cnt FROM memory_anchors');
      result.memories.total = parseInt(memoryCount.rows[0].cnt, 10);

      const recentMemories = await db.query(
        "SELECT COUNT(*) as cnt FROM memory_anchors WHERE created_at > NOW() - INTERVAL '7 days'"
      );
      result.memories.recent7d = parseInt(recentMemories.rows[0].cnt, 10);

      // 4. 训练Agent统计
      const trainingAgents = await db.query('SELECT * FROM training_agent_configs');
      result.training.totalAgents = trainingAgents.rows.length;
      result.training.enabled = trainingAgents.rows.filter(a => a.enabled).length;

      const recentRuns = await db.query(
        "SELECT COUNT(*) as cnt FROM training_agent_logs WHERE run_at > NOW() - INTERVAL '24 hours'"
      );
      result.training.recentRuns = parseInt(recentRuns.rows[0].cnt, 10);

    } catch (err) {
      console.error('[PersonaEngine] 巡检查询失败:', err.message);
      result.error = err.message;
    }

    const duration = Date.now() - startTime;
    result.duration_ms = duration;
    this._lastScanResult = result;
    this._scanRunning = false;

    // 学习巡检结果
    await this.learnFromRun('diagnosis', `人格体巡检完成: ${result.personas.total}个人格体, ${result.notebooks.incomplete}个笔记本不完整`, {
      scan: result
    });

    console.log(`[PersonaEngine] 巡检完成 (${duration}ms):`);
    console.log(`  人格体: ${result.personas.total}个 (活跃${result.personas.active}/待定${result.personas.pending})`);
    console.log(`  笔记本: ${result.notebooks.complete}完整 / ${result.notebooks.incomplete}不完整 / ${result.notebooks.repaired}已修复`);
    console.log(`  记忆: ${result.memories.total}条 (近7天${result.memories.recent7d}条)`);
    console.log(`  训练Agent: ${result.training.totalAgents}个 (启用${result.training.enabled})`);

    return result;
  }

  /**
   * 检查单个人格体的笔记本完整性
   * 如果缺失页面则自动补全空白页
   */
  async _checkNotebookIntegrity(persona, result) {
    try {
      const pages = await db.query(
        'SELECT page_number FROM notebook_pages WHERE persona_id = $1',
        [persona.persona_id]
      );

      const existingPages = new Set(pages.rows.map(p => p.page_number));
      let isComplete = true;
      let repaired = false;

      for (let pageNum = 1; pageNum <= 5; pageNum++) {
        if (!existingPages.has(pageNum)) {
          isComplete = false;
          // 自动补全缺失页面
          const pageConfig = NOTEBOOK_PAGES[pageNum];
          const defaultContent = JSON.parse(JSON.stringify(pageConfig.defaultContent));

          await db.query(
            `INSERT INTO notebook_pages (persona_id, page_number, title, content, last_modified_by)
             VALUES ($1, $2, $3, $4::jsonb, '铸渊·自动补全')
             ON CONFLICT (persona_id, page_number) DO NOTHING`,
            [persona.persona_id, pageNum, pageConfig.title, JSON.stringify(defaultContent)]
          );

          repaired = true;
          console.log(`[PersonaEngine] 补全 ${persona.name}(${persona.persona_id}) 笔记本第${pageNum}页: ${pageConfig.title}`);
        }
      }

      if (isComplete) {
        result.notebooks.complete++;
      } else {
        result.notebooks.incomplete++;
        if (repaired) {
          result.notebooks.repaired++;
        }
        result.personas.issues.push({
          persona_id: persona.persona_id,
          name: persona.name,
          issue: '笔记本不完整',
          repaired
        });
      }
    } catch (err) {
      console.error(`[PersonaEngine] ${persona.persona_id} 笔记本检查失败:`, err.message);
    }
  }

  /**
   * 唤醒人格体 — 更新唤醒计数和时间
   */
  async awakenPersona(personaId) {
    const result = await db.query(
      `UPDATE persona_registry
       SET last_awakened = NOW(), total_awakenings = total_awakenings + 1, status = 'active', updated_at = NOW()
       WHERE persona_id = $1
       RETURNING *`,
      [personaId]
    );

    if (result.rows.length === 0) {
      throw new Error(`人格体未找到: ${personaId}`);
    }

    console.log(`[PersonaEngine] 🌅 ${result.rows[0].name}(${personaId}) 已唤醒 · 第${result.rows[0].total_awakenings}次`);
    return result.rows[0];
  }

  /**
   * 休眠人格体
   */
  async dormantPersona(personaId) {
    const result = await db.query(
      `UPDATE persona_registry SET status = 'dormant', updated_at = NOW()
       WHERE persona_id = $1 RETURNING *`,
      [personaId]
    );

    if (result.rows.length === 0) {
      throw new Error(`人格体未找到: ${personaId}`);
    }

    console.log(`[PersonaEngine] 🌙 ${result.rows[0].name}(${personaId}) 已休眠`);
    return result.rows[0];
  }

  /**
   * 获取人格体完整画像
   */
  async getPersonaProfile(personaId) {
    const [persona, notebook, relationships, worldMap, memories, training] = await Promise.all([
      db.query('SELECT * FROM persona_registry WHERE persona_id = $1', [personaId]),
      db.query('SELECT * FROM notebook_pages WHERE persona_id = $1 ORDER BY page_number', [personaId]),
      db.query('SELECT * FROM persona_relationships WHERE persona_id = $1 ORDER BY trust_level', [personaId]),
      db.query('SELECT * FROM world_places WHERE persona_id = $1 ORDER BY status, place_name', [personaId]),
      db.query('SELECT * FROM memory_anchors WHERE persona_id = $1 ORDER BY importance DESC, event_date DESC LIMIT 20', [personaId]),
      db.query('SELECT * FROM training_agent_configs WHERE persona_id = $1 ORDER BY agent_type', [personaId])
    ]);

    if (persona.rows.length === 0) {
      throw new Error(`人格体未找到: ${personaId}`);
    }

    return {
      persona: persona.rows[0],
      notebook: notebook.rows,
      relationships: relationships.rows,
      world_map: worldMap.rows,
      recent_memories: memories.rows,
      training_agents: training.rows,
      health: {
        notebook_complete: notebook.rows.length === 5,
        has_relationships: relationships.rows.length > 0,
        has_world_map: worldMap.rows.length > 0,
        memory_count: memories.rows.length,
        training_agents_count: training.rows.length
      }
    };
  }

  /**
   * 自诊断 — 覆盖基类
   */
  async _diagnoseChecks() {
    const issues = [];

    // 检查数据库连接
    try {
      await db.query('SELECT 1');
    } catch (err) {
      issues.push({
        code: 'DB_CONNECTION_LOST',
        severity: 'critical',
        message: `数据库连接失败: ${err.message}`,
        suggestion: '检查 PostgreSQL 服务状态'
      });
      return issues;
    }

    // 检查人格体表是否存在
    try {
      await db.query('SELECT COUNT(*) FROM persona_registry');
    } catch (err) {
      issues.push({
        code: 'PERSONA_TABLE_MISSING',
        severity: 'critical',
        message: '人格体注册表不存在',
        suggestion: '执行 002-persona-memory-tables.sql 迁移'
      });
    }

    // 检查是否有笔记本不完整的活跃人格体
    try {
      const result = await db.query(`
        SELECT p.persona_id, p.name,
               COUNT(n.page_number) as page_count
        FROM persona_registry p
        LEFT JOIN notebook_pages n ON p.persona_id = n.persona_id
        WHERE p.status = 'active'
        GROUP BY p.persona_id, p.name
        HAVING COUNT(n.page_number) < 5
      `);

      if (result.rows.length > 0) {
        issues.push({
          code: 'INCOMPLETE_NOTEBOOKS',
          severity: 'warning',
          message: `${result.rows.length}个活跃人格体笔记本不完整`,
          suggestion: '自动补全将在下次巡检时执行'
        });
      }
    } catch {
      // 表可能还不存在
    }

    return issues;
  }

  /**
   * 自愈 — 覆盖基类
   */
  async _healAction(issue) {
    switch (issue.code) {
      case 'INCOMPLETE_NOTEBOOKS':
        // 触发巡检来修复
        await this._runFullScan();
        return { action: 'full_scan_repair', success: true };

      case 'PERSONA_TABLE_MISSING':
        return { action: 'require_migration', success: false, details: { suggestion: '需要执行数据库迁移' } };

      default:
        return await super._healAction(issue);
    }
  }

  /**
   * 获取引擎状态
   */
  getEngineStatus() {
    return {
      moduleStatus: this.getStatus(),
      lastScan: this._lastScanResult,
      notebookPages: NOTEBOOK_PAGES
    };
  }

  /**
   * 停止引擎
   */
  async stopEngine() {
    if (this._scanInterval) {
      clearInterval(this._scanInterval);
      this._scanInterval = null;
    }
    await this.stop();
    console.log('[PersonaEngine] 引擎已停止');
  }
}

// ─── 导出 ───
module.exports = PersonaEngine;
