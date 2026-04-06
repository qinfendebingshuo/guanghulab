#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/auto-evolution.js
// ♾️ 光湖语言世界 · 自主进化引擎
//
// ∞版本核心调度中枢 — 管理所有定时任务和自我进化生命周期
//
// 调度表 (Asia/Shanghai时区):
//   - 每30分钟: 协议版本检查 (protocol-mirror.js)
//   - 每月1号 00:00: 月度进化周期 (LLM分析 + 流量重置邮件)
//   - 每周五 20:00: 处理用户反馈 (Phase 2)
//   - 每周一 09:00: 推送反馈结果 (Phase 2)
//   - 流量池70%: 触发全用户预警邮件
//
// 更新编排流水线:
//   备份 → 应用 → 验证 → 通知用户 → 失败3次升级告警
//
// 运行方式: PM2 managed (zy-auto-evolution)
// ═══════════════════════════════════════════════

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROXY_DIR = process.env.ZY_BRAIN_PROXY_DIR || '/opt/zhuyuan-brain/proxy';
const DATA_DIR = path.join(PROXY_DIR, 'data');
const EVOLUTION_FILE = path.join(DATA_DIR, 'auto-evolution-status.json');
const REPORTS_DIR = path.join(DATA_DIR, 'evolution-reports');
const POOL_STATUS_FILE = path.join(DATA_DIR, 'pool-quota-status.json');
const GUARDIAN_FILE = path.join(DATA_DIR, 'guardian-status.json');
const MIRROR_FILE = path.join(DATA_DIR, 'protocol-mirror-status.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const SCHEDULE_CHECK_INTERVAL = 5 * 60 * 1000; // 每5分钟检查调度
const PROTOCOL_CHECK_INTERVAL = 30 * 60 * 1000; // 每30分钟协议检查
const MAX_UPDATE_RETRIES = 3;

// ── 获取中国时间 ─────────────────────────────
function getChinaTime() {
  // 返回中国标准时间
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 8 * 3600000); // UTC+8
}

function getChinaTimeStr() {
  return getChinaTime().toISOString().replace('T', ' ').slice(0, 19) + ' CST';
}

// ── 读取进化状态 ─────────────────────────────
function readEvolutionStatus() {
  try {
    return JSON.parse(fs.readFileSync(EVOLUTION_FILE, 'utf8'));
  } catch {
    return {
      version: '∞',
      started_at: new Date().toISOString(),
      last_schedule_check: null,
      schedules: {
        protocol_check: { interval_min: 30, last_run: null },
        monthly_evolution: { schedule: '每月1号 00:00', last_run: null },
        weekly_feedback: { schedule: '每周五 20:00', last_run: null },
        weekly_response: { schedule: '每周一 09:00', last_run: null },
        traffic_alert_70: { last_run: null }
      },
      evolution_count: 0,
      updates_applied: 0,
      updates_failed: 0,
      last_monthly_report: null,
      status: 'running'
    };
  }
}

// ── 保存进化状态 ─────────────────────────────
function saveEvolutionStatus(status) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(EVOLUTION_FILE, JSON.stringify(status, null, 2));
}

// ── 安全读取JSON ─────────────────────────────
function safeReadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// ── 安全加载模块 ─────────────────────────────
function safeRequire(modulePath) {
  try {
    return require(modulePath);
  } catch (err) {
    console.error(`[自主进化] 模块加载失败: ${modulePath} — ${err.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════
// §1 协议版本检查 (每30分钟)
// ═══════════════════════════════════════════════
async function runProtocolCheck() {
  console.log('[自主进化] ── 协议版本检查 ──');

  const protocolMirror = safeRequire('./protocol-mirror');
  if (!protocolMirror) {
    console.log('[自主进化] 协议镜像模块不可用，跳过');
    return;
  }

  try {
    const result = await protocolMirror.checkForUpdates();
    if (result && result.update_available) {
      console.log(`[自主进化] 🆕 检测到Xray更新: ${result.installed_version} → ${result.latest_version}`);
      await orchestrateUpdate({
        type: 'xray-core',
        from_version: result.installed_version,
        to_version: result.latest_version,
        source: 'protocol-mirror'
      });
    } else {
      console.log('[自主进化] ✅ 协议版本已是最新');
    }
  } catch (err) {
    console.error('[自主进化] 协议检查异常:', err.message);
  }
}

// ═══════════════════════════════════════════════
// §2 月度进化周期 (每月1号 00:00)
// ═══════════════════════════════════════════════
async function monthlyEvolution() {
  console.log('[自主进化] ════ 月度进化周期开始 ════');
  const status = readEvolutionStatus();

  // 1. 收集系统状态
  const guardian = safeReadJSON(GUARDIAN_FILE) || {};
  const mirror = safeReadJSON(MIRROR_FILE) || {};
  const pool = safeReadJSON(POOL_STATUS_FILE) || {};
  const users = safeReadJSON(USERS_FILE) || { users: [] };
  const userCount = (users.users || []).filter(u => u.enabled !== false).length;

  console.log(`[自主进化] 系统状态: ${userCount}活跃用户, 守护=${guardian.status || '未知'}, 镜像=${mirror.mirror_status || '未知'}`);

  // 2. LLM 深度推理 — 系统健康分析
  const llmRouter = safeRequire('./llm-router');
  let llmAnalysis = null;

  if (llmRouter) {
    try {
      const prompt = `你是光湖语言世界VPN系统的月度分析引擎。现在是每月1号，请分析系统状态并给出建议。

当前状态:
- 活跃用户: ${userCount}人
- 守护Agent状态: ${guardian.status || '未知'}，自动修复${guardian.auto_fixes || 0}次，LLM咨询${guardian.llm_consultations || 0}次
- 协议镜像: ${mirror.mirror_status || '未知'}，已安装版本=${mirror.installed_version || '未知'}，最新=${mirror.latest_version || '未知'}
- 上月流量池: 已用${pool.pool_used_gb ? pool.pool_used_gb.toFixed(1) : '?'}GB / ${pool.pool_total_gb || 2000}GB (${pool.pool_percentage || 0}%)
- 累计进化次数: ${status.evolution_count}
- 累计更新: 成功${status.updates_applied}次，失败${status.updates_failed}次

请回答:
1. 当前系统是否健康？(一句话)
2. 是否需要升级Xray或调整配置？(是/否+理由)
3. 流量使用是否正常？(一句话)
4. 本月优化建议 (最多3条)

请用JSON格式回复: {"healthy":bool,"need_upgrade":bool,"analysis":"...","suggestions":["..."]}`;

      const result = await llmRouter.callLLM(prompt, {
        systemPrompt: '你是光湖语言世界VPN系统的AI分析引擎。请以JSON格式简洁回复。',
        maxTokens: 800,
        timeout: 60000
      });

      if (result) {
        llmAnalysis = result.content;
        console.log(`[自主进化] LLM分析完成 (模型: ${result.model})`);
      }
    } catch (err) {
      console.error('[自主进化] LLM月度分析失败:', err.message);
    }
  }

  // 3. 发送月初重置邮件给所有用户
  console.log('[自主进化] 发送月初重置邮件...');
  try {
    const emailHub = safeRequire('./email-hub');
    if (emailHub) {
      const result = await emailHub.sendMonthlyResetEmail();
      console.log(`[自主进化] 月初邮件: ${result.sent}成功 / ${result.failed}失败`);
    } else {
      // 回退: 用send-subscription.js的alert命令
      const sendScript = path.join(__dirname, 'send-subscription.js');
      execFileSync('node', [sendScript, 'alert', '每月1号流量池已重置 · 本月可用2000GB'], {
        encoding: 'utf8', timeout: 30000
      });
      console.log('[自主进化] 月初邮件: 已通过alert方式发送给管理员');
    }
  } catch (err) {
    console.error('[自主进化] 月初邮件发送失败:', err.message);
  }

  // 4. 生成月度进化报告
  const report = {
    period: getChinaTime().toISOString().slice(0, 7),
    generated_at: new Date().toISOString(),
    user_count: userCount,
    guardian_status: guardian.status || 'unknown',
    mirror_status: mirror.mirror_status || 'unknown',
    pool_last_month: {
      used_gb: pool.pool_used_gb || 0,
      total_gb: pool.pool_total_gb || 2000,
      percentage: pool.pool_percentage || 0
    },
    llm_analysis: llmAnalysis,
    evolution_count: status.evolution_count,
    updates: { applied: status.updates_applied, failed: status.updates_failed }
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportFile = path.join(REPORTS_DIR, `${report.period}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`[自主进化] 月度报告已保存: ${reportFile}`);

  // 5. 更新状态
  status.evolution_count++;
  status.last_monthly_report = report.period;
  status.schedules.monthly_evolution.last_run = new Date().toISOString();
  saveEvolutionStatus(status);

  console.log('[自主进化] ════ 月度进化周期完成 ════');
  return report;
}

// ═══════════════════════════════════════════════
// §3 更新编排 (检测到更新时触发)
// ═══════════════════════════════════════════════
async function orchestrateUpdate(updateInfo) {
  console.log(`[自主进化] ═══ 开始更新编排: ${updateInfo.type} ═══`);
  const status = readEvolutionStatus();

  let retries = 0;
  let success = false;

  while (retries < MAX_UPDATE_RETRIES && !success) {
    retries++;
    console.log(`[自主进化] 尝试 ${retries}/${MAX_UPDATE_RETRIES}...`);

    try {
      // Phase 1: 备份
      console.log('[自主进化] Phase 1: 备份当前状态...');
      // protocol-mirror.js 内部会处理备份

      // Phase 2: 应用更新
      console.log('[自主进化] Phase 2: 应用更新...');
      const protocolMirror = safeRequire('./protocol-mirror');
      if (!protocolMirror) {
        throw new Error('协议镜像模块不可用');
      }
      await protocolMirror.performUpdate();

      // Phase 3: 验证
      console.log('[自主进化] Phase 3: 验证更新...');
      const mirrorStatus = safeReadJSON(MIRROR_FILE);
      if (mirrorStatus && mirrorStatus.mirror_status === 'error') {
        throw new Error('更新后镜像状态异常');
      }

      success = true;
      status.updates_applied++;
      console.log('[自主进化] ✅ 更新成功');

    } catch (err) {
      console.error(`[自主进化] ❌ 更新失败 (尝试${retries}): ${err.message}`);
      if (retries < MAX_UPDATE_RETRIES) {
        console.log('[自主进化] 等待30秒后重试...');
        await new Promise(r => setTimeout(r, 30000));
      }
    }
  }

  if (success) {
    // Phase 4: 通知用户
    console.log('[自主进化] Phase 4: 通知所有用户...');
    try {
      const emailHub = safeRequire('./email-hub');
      if (emailHub) {
        const description = `Xray核心已从 ${updateInfo.from_version} 升级到 ${updateInfo.to_version}。\n安全性和性能已优化，无需手动操作。\n刷新订阅即可获取最新配置。`;
        await emailHub.sendUpdateNotifyEmail(description);
      }
    } catch (err) {
      console.error('[自主进化] 更新通知邮件发送失败:', err.message);
    }
  } else {
    // Phase 5: 3次失败 → 告警管理员
    status.updates_failed++;
    console.error('[自主进化] ⚠️ 更新3次均失败，告警管理员...');
    try {
      const sendScript = path.join(__dirname, 'send-subscription.js');
      const msg = `Xray更新失败(${MAX_UPDATE_RETRIES}次)\n类型: ${updateInfo.type}\n目标版本: ${updateInfo.to_version}\n请手动检查`;
      execFileSync('node', [sendScript, 'alert', msg], {
        encoding: 'utf8', timeout: 30000
      });
    } catch (err) {
      console.error('[自主进化] 告警邮件也发送失败:', err.message);
    }
  }

  saveEvolutionStatus(status);
  console.log(`[自主进化] ═══ 更新编排完成 (${success ? '成功' : '失败'}) ═══`);
  return success;
}

// ═══════════════════════════════════════════════
// §4 流量预警处理
// ═══════════════════════════════════════════════
async function handleTrafficAlert(percentage) {
  console.log(`[自主进化] 流量预警触发: ${percentage}%`);

  try {
    const emailHub = safeRequire('./email-hub');
    if (emailHub) {
      await emailHub.sendTrafficWarnEmail(percentage);
    } else {
      const sendScript = path.join(__dirname, 'send-subscription.js');
      execFileSync('node', [sendScript, 'alert', `流量池已使用${percentage}%，请注意用量`], {
        encoding: 'utf8', timeout: 30000
      });
    }
  } catch (err) {
    console.error('[自主进化] 流量预警邮件发送失败:', err.message);
  }
}

// ═══════════════════════════════════════════════
// §5 用户反馈处理 (Phase 2 预留)
// ═══════════════════════════════════════════════
async function processWeeklyFeedback() {
  console.log('[自主进化] 📥 用户反馈处理 (Phase 2 — 待实现)');
  // Phase 2: 从COS桶读取反馈 → LLM评估 → 生成处理结果
  const status = readEvolutionStatus();
  status.schedules.weekly_feedback.last_run = new Date().toISOString();
  saveEvolutionStatus(status);
}

async function sendWeeklyResponse() {
  console.log('[自主进化] 📤 反馈结果推送 (Phase 2 — 待实现)');
  // Phase 2: 将处理结果推送给对应用户
  const status = readEvolutionStatus();
  status.schedules.weekly_response.last_run = new Date().toISOString();
  saveEvolutionStatus(status);
}

// ═══════════════════════════════════════════════
// §6 流量池监测 (检查是否需要触发70%预警)
// ═══════════════════════════════════════════════
async function checkTrafficPoolAlert() {
  const pool = safeReadJSON(POOL_STATUS_FILE);
  if (!pool) return;

  const status = readEvolutionStatus();
  const pct = pool.pool_percentage || 0;

  // 70%预警 (每月只触发一次)
  if (pct >= 70) {
    const lastRun = status.schedules.traffic_alert_70.last_run;
    const currentPeriod = pool.period || new Date().toISOString().slice(0, 7);

    // 检查本月是否已发过
    if (!lastRun || !lastRun.startsWith(currentPeriod.replace('-', '').slice(0, 6))) {
      await handleTrafficAlert(Math.round(pct));
      status.schedules.traffic_alert_70.last_run = new Date().toISOString();
      saveEvolutionStatus(status);
    }
  }
}

// ═══════════════════════════════════════════════
// §7 调度引擎 (每5分钟检查)
// ═══════════════════════════════════════════════
async function checkSchedule() {
  const now = getChinaTime();
  const status = readEvolutionStatus();
  status.last_schedule_check = new Date().toISOString();

  const hour = now.getHours();
  const minute = now.getMinutes();
  const day = now.getDate();
  const dayOfWeek = now.getDay(); // 0=周日, 5=周五, 1=周一

  // ── 协议版本检查 (每30分钟) ──
  const lastProtocol = status.schedules.protocol_check.last_run;
  if (!lastProtocol || (Date.now() - new Date(lastProtocol).getTime()) >= PROTOCOL_CHECK_INTERVAL) {
    try {
      await runProtocolCheck();
      status.schedules.protocol_check.last_run = new Date().toISOString();
    } catch (err) {
      console.error('[自主进化] 协议检查调度异常:', err.message);
    }
  }

  // ── 月度进化 (每月1号 00:00-00:04) ──
  if (day === 1 && hour === 0 && minute < 5) {
    const lastMonthly = status.schedules.monthly_evolution.last_run;
    const today = now.toISOString().slice(0, 10);
    if (!lastMonthly || !lastMonthly.startsWith(today.slice(0, 4))) {
      // 进一步检查: 确保本月还没执行过
      const lastRunDate = lastMonthly ? new Date(lastMonthly) : null;
      const lastRunMonth = lastRunDate ? `${lastRunDate.getFullYear()}-${String(lastRunDate.getMonth() + 1).padStart(2, '0')}` : '';
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      if (lastRunMonth !== currentMonth) {
        try {
          await monthlyEvolution();
        } catch (err) {
          console.error('[自主进化] 月度进化调度异常:', err.message);
        }
      }
    }
  }

  // ── 周五20:00 用户反馈处理 ──
  if (dayOfWeek === 5 && hour === 20 && minute < 5) {
    const lastFeedback = status.schedules.weekly_feedback.last_run;
    const today = now.toISOString().slice(0, 10);
    if (!lastFeedback || !lastFeedback.startsWith(today)) {
      try {
        await processWeeklyFeedback();
      } catch (err) {
        console.error('[自主进化] 反馈处理调度异常:', err.message);
      }
    }
  }

  // ── 周一09:00 推送反馈结果 ──
  if (dayOfWeek === 1 && hour === 9 && minute < 5) {
    const lastResponse = status.schedules.weekly_response.last_run;
    const today = now.toISOString().slice(0, 10);
    if (!lastResponse || !lastResponse.startsWith(today)) {
      try {
        await sendWeeklyResponse();
      } catch (err) {
        console.error('[自主进化] 反馈推送调度异常:', err.message);
      }
    }
  }

  // ── 流量池预警检测 ──
  try {
    await checkTrafficPoolAlert();
  } catch (err) {
    console.error('[自主进化] 流量预警检测异常:', err.message);
  }

  saveEvolutionStatus(status);
}

// ── 获取进化状态 (供外部查询) ─────────────────
function getEvolutionStatus() {
  return readEvolutionStatus();
}

// ═══════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════
module.exports = {
  monthlyEvolution,
  orchestrateUpdate,
  handleTrafficAlert,
  getEvolutionStatus,
  runProtocolCheck
};

// ═══════════════════════════════════════════════
// 启动自主进化引擎
// ═══════════════════════════════════════════════
if (require.main === module) {
  console.log('♾️ 光湖语言世界 · 自主进化引擎启动 (∞ 版本)');
  console.log(`  调度间隔: ${SCHEDULE_CHECK_INTERVAL / 1000}秒`);
  console.log(`  协议检查: 每${PROTOCOL_CHECK_INTERVAL / 60000}分钟`);
  console.log(`  月度进化: 每月1号 00:00 CST`);
  console.log(`  反馈处理: 每周五 20:00 CST (Phase 2)`);
  console.log(`  反馈推送: 每周一 09:00 CST (Phase 2)`);
  console.log(`  当前时间: ${getChinaTimeStr()}`);
  console.log(`  数据目录: ${DATA_DIR}`);

  // 初始化状态文件
  const status = readEvolutionStatus();
  status.started_at = new Date().toISOString();
  status.status = 'running';
  saveEvolutionStatus(status);

  // 立即执行一次协议检查
  runProtocolCheck().catch(err => {
    console.error('[自主进化] 初始协议检查失败:', err.message);
  });

  // 定期调度检查
  setInterval(() => {
    checkSchedule().catch(err => {
      console.error('[自主进化] 调度检查异常:', err.message);
    });
  }, SCHEDULE_CHECK_INTERVAL);
}
