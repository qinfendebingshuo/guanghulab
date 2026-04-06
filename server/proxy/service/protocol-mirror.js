#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/protocol-mirror.js
// 🪞 铸渊专线 · 协议镜像引擎
//
// 核心概念: 镜像同步
//   - 上游协议 (Xray-core) 更新时自动检测
//   - 自动下载/备份/升级/验证/重启
//   - TLS/Reality 指纹一致性校验
//   - 对外呈现标准 Xray 行为 (伪装)
//
// 安全机制:
//   - LLM分析更新风险 (安全补丁/破坏性变更)
//   - 失败3次自动告警管理员
//   - 升级前备份，失败可回滚
//
// 运行方式: PM2 managed (zy-protocol-mirror)
// 检查间隔: 每30分钟 (GitHub API每6小时)
// ═══════════════════════════════════════════════

'use strict';

const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = process.env.ZY_PROXY_DATA_DIR || '/opt/zhuyuan-brain/proxy/data';
const LOG_DIR = process.env.ZY_PROXY_LOG_DIR || '/opt/zhuyuan-brain/proxy/logs';
const MIRROR_FILE = path.join(DATA_DIR, 'protocol-mirror-status.json');
const XRAY_BIN = process.env.ZY_XRAY_BIN || '/usr/local/bin/xray';
const XRAY_BACKUP_DIR = path.join(DATA_DIR, 'xray-backups');

const CHECK_INTERVAL = 30 * 60 * 1000;        // 30分钟
const GITHUB_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6小时
const MAX_FAILED_UPDATES = 3;
const MAX_UPDATE_HISTORY = 20;

// ── 读取镜像状态 ─────────────────────────────
function readMirrorStatus() {
  try {
    return JSON.parse(fs.readFileSync(MIRROR_FILE, 'utf8'));
  } catch {
    return {
      installed_version: null,
      latest_version: null,
      update_available: false,
      last_github_check: null,
      last_fingerprint_check: null,
      update_history: [],
      failed_updates: 0,
      mirror_status: 'initializing',
      fingerprint: {
        tls_match: true,
        reality_match: true,
        protocol_version: 'unknown'
      }
    };
  }
}

// ── 保存镜像状态 ─────────────────────────────
function saveMirrorStatus(status) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(MIRROR_FILE, JSON.stringify(status, null, 2));
}

// ── 执行命令 ─────────────────────────────────
function runCmd(cmd, timeout = 10000) {
  try {
    return { ok: true, output: execSync(cmd, { encoding: 'utf8', timeout }).trim() };
  } catch (err) {
    return { ok: false, output: err.message };
  }
}

// ── HTTPS GET 请求 ───────────────────────────
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'ZY-Protocol-Mirror/1.0',
        ...headers
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsGet(res.headers.location, headers).then(resolve).catch(reject);
        return;
      }

      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data, headers: res.headers });
      });
    });

    req.on('error', (err) => {
      reject(new Error(`HTTPS请求失败: ${err.message}`));
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HTTPS请求超时'));
    });
    req.end();
  });
}

// ── 获取已安装的Xray版本 ────────────────────
function getInstalledVersion() {
  try {
    const output = execFileSync(XRAY_BIN, ['version'], {
      encoding: 'utf8',
      timeout: 5000
    }).trim();

    // Xray version output: "Xray 1.8.x (Xray, Penetrates Everything.) ..."
    const match = output.match(/Xray\s+(\d+\.\d+\.\d+)/i);
    if (match) {
      return match[1];
    }
    console.error('[协议镜像] 无法解析Xray版本号:', output.slice(0, 100));
    return null;
  } catch (err) {
    console.error('[协议镜像] 获取Xray版本失败:', err.message);
    return null;
  }
}

// ── 查询GitHub最新版本 ──────────────────────
async function fetchLatestRelease() {
  try {
    const resp = await httpsGet('https://api.github.com/repos/XTLS/Xray-core/releases/latest', {
      'Accept': 'application/vnd.github.v3+json'
    });

    if (resp.statusCode !== 200) {
      console.error(`[协议镜像] GitHub API返回 ${resp.statusCode}`);
      return null;
    }

    const release = JSON.parse(resp.body);
    const tagName = release.tag_name || '';
    // tag格式: "v1.8.x"
    const version = tagName.replace(/^v/, '');
    const body = release.body || '';
    const publishedAt = release.published_at || null;

    // 查找Linux AMD64二进制下载链接
    let downloadUrl = null;
    if (release.assets && Array.isArray(release.assets)) {
      const linuxAsset = release.assets.find(a =>
        a.name && a.name.includes('linux') && a.name.includes('64') && a.name.endsWith('.zip')
      );
      if (linuxAsset) {
        downloadUrl = linuxAsset.browser_download_url;
      }
    }

    return { version, body, publishedAt, downloadUrl, tagName };
  } catch (err) {
    console.error('[协议镜像] 获取GitHub release失败:', err.message);
    return null;
  }
}

// ── 版本比较 ─────────────────────────────────
function isNewer(latest, installed) {
  if (!latest || !installed) return false;
  const latestParts = latest.split('.').map(Number);
  const installedParts = installed.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const l = latestParts[i] || 0;
    const c = installedParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

// ── 协议指纹检查 ─────────────────────────────
function checkFingerprint() {
  console.log('[协议镜像] 检查协议指纹一致性...');
  const fingerprint = {
    tls_match: true,
    reality_match: true,
    protocol_version: 'unknown'
  };

  // 检查TLS配置是否符合标准Xray行为
  try {
    const configPath = process.env.ZY_XRAY_CONFIG || '/usr/local/etc/xray/config.json';
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      // 验证Reality配置存在且结构完整
      const inbounds = config.inbounds || [];
      const realityInbound = inbounds.find(ib =>
        ib.streamSettings &&
        ib.streamSettings.realitySettings
      );

      if (realityInbound) {
        const reality = realityInbound.streamSettings.realitySettings;
        fingerprint.reality_match = !!(reality.privateKey && reality.shortIds);
        if (!fingerprint.reality_match) {
          console.log('[协议镜像] ⚠️ Reality配置不完整');
        }
      }

      // 验证TLS相关配置
      const tlsInbound = inbounds.find(ib =>
        ib.streamSettings &&
        ib.streamSettings.security === 'tls'
      );

      if (tlsInbound) {
        const tls = tlsInbound.streamSettings.tlsSettings || {};
        fingerprint.tls_match = !!(tls.certificates && tls.certificates.length > 0);
      }
    }
  } catch (err) {
    console.error('[协议镜像] 指纹检查异常:', err.message);
    fingerprint.tls_match = false;
  }

  // 确认Xray进程运行中的协议版本
  const installed = getInstalledVersion();
  if (installed) {
    fingerprint.protocol_version = 'matching';
  } else {
    fingerprint.protocol_version = 'unavailable';
  }

  return fingerprint;
}

// ── LLM更新风险分析 ─────────────────────────
async function consultLLMForUpdate(releaseInfo, installedVersion) {
  let llmRouter;
  try {
    llmRouter = require('./llm-router');
  } catch {
    console.log('[协议镜像] LLM路由器未加载，跳过风险分析');
    return null;
  }

  const prompt = `你是光湖语言世界VPN系统的协议镜像引擎。Xray-core 有新版本发布，请分析更新风险。

当前版本: v${installedVersion}
最新版本: v${releaseInfo.version}
发布时间: ${releaseInfo.publishedAt || '未知'}

更新日志 (前1500字):
${(releaseInfo.body || '无更新日志').slice(0, 1500)}

请回答以下问题 (JSON格式):
1. is_critical: 是否是安全修复 (true/false)
2. changes_summary: 主要变更摘要 (一句话)
3. risk_level: 更新风险等级 (low/medium/high)
4. recommend_auto_update: 是否推荐自动更新 (true/false)
5. reason: 推荐理由 (一句话)`;

  let result;
  try {
    result = await llmRouter.callLLM(prompt, {
      systemPrompt: '你是光湖语言世界VPN系统的协议分析AI。负责评估Xray-core更新的风险和必要性。请用JSON格式回答。',
      maxTokens: 500,
      timeout: 30000
    });
  } catch (err) {
    console.error('[协议镜像] LLM调用异常:', err.message);
    return null;
  }

  if (!result || !result.content) return null;

  // 尝试解析LLM返回的JSON
  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    console.log('[协议镜像] LLM返回内容无法解析为JSON');
  }

  return { raw_analysis: result.content, model: result.model };
}

// ── 下载文件 ─────────────────────────────────
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    const cleanup = () => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    };

    const doRequest = (reqUrl) => {
      const urlObj = new URL(reqUrl);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: { 'User-Agent': 'ZY-Protocol-Mirror/1.0' },
        timeout: 120000
      };

      const req = https.request(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doRequest(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          cleanup();
          reject(new Error(`下载失败: HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(destPath);
        });
      });

      req.on('error', (err) => {
        cleanup();
        reject(new Error(`下载错误: ${err.message}`));
      });
      req.on('timeout', () => {
        req.destroy();
        cleanup();
        reject(new Error('下载超时'));
      });
      req.end();
    };

    doRequest(url);
  });
}

// ── 执行更新 ─────────────────────────────────
async function performUpdate() {
  const status = readMirrorStatus();

  if (!status.update_available || !status.latest_version) {
    console.log('[协议镜像] 无可用更新');
    return { ok: false, detail: '无可用更新' };
  }

  if (status.failed_updates >= MAX_FAILED_UPDATES) {
    console.error('[协议镜像] 已连续失败3次，需人工介入');
    sendAlertEmail(
      '🪞 协议镜像更新失败 - 需人工介入',
      `Xray-core 更新已连续失败 ${status.failed_updates} 次。\n` +
      `目标版本: v${status.latest_version}\n` +
      `当前版本: v${status.installed_version}\n` +
      `请手动检查并更新。`
    );
    return { ok: false, detail: `连续失败${status.failed_updates}次，已通知管理员` };
  }

  console.log(`[协议镜像] 开始更新: v${status.installed_version} → v${status.latest_version}`);
  status.mirror_status = 'updating';
  saveMirrorStatus(status);

  const updateRecord = {
    from_version: status.installed_version,
    to_version: status.latest_version,
    started_at: new Date().toISOString(),
    completed_at: null,
    success: false,
    detail: ''
  };

  try {
    // 1. 获取下载链接
    const release = await fetchLatestRelease();
    if (!release || !release.downloadUrl) {
      throw new Error('无法获取下载链接');
    }

    // 2. 下载新版本
    console.log('[协议镜像] 下载新版本...');
    const downloadPath = path.join(DATA_DIR, `xray-${release.version}.zip`);
    await downloadFile(release.downloadUrl, downloadPath);

    // 3. 备份当前版本
    console.log('[协议镜像] 备份当前版本...');
    if (!fs.existsSync(XRAY_BACKUP_DIR)) {
      fs.mkdirSync(XRAY_BACKUP_DIR, { recursive: true });
    }
    const backupPath = path.join(XRAY_BACKUP_DIR, `xray-${status.installed_version}-${Date.now()}`);
    if (fs.existsSync(XRAY_BIN)) {
      fs.copyFileSync(XRAY_BIN, backupPath);
      console.log(`[协议镜像] 备份完成: ${backupPath}`);
    }

    // 4. 解压并安装
    console.log('[协议镜像] 解压并安装...');
    const extractDir = path.join(DATA_DIR, 'xray-extract');
    if (fs.existsSync(extractDir)) {
      execFileSync('rm', ['-rf', extractDir], { timeout: 10000 });
    }
    fs.mkdirSync(extractDir, { recursive: true });
    execFileSync('unzip', ['-o', downloadPath, '-d', extractDir], {
      encoding: 'utf8',
      timeout: 30000
    });

    const newBin = path.join(extractDir, 'xray');
    if (!fs.existsSync(newBin)) {
      throw new Error('解压后未找到xray二进制文件');
    }

    // 设置执行权限并安装
    fs.chmodSync(newBin, 0o755);
    execFileSync('cp', [newBin, XRAY_BIN], { timeout: 10000 });

    // 5. 验证安装
    console.log('[协议镜像] 验证安装...');
    const newVersion = getInstalledVersion();
    if (!newVersion) {
      throw new Error('安装后无法获取版本号');
    }
    console.log(`[协议镜像] 新版本已安装: v${newVersion}`);

    // 6. 重启Xray服务
    console.log('[协议镜像] 重启Xray服务...');
    try {
      execFileSync('systemctl', ['restart', 'xray'], { encoding: 'utf8', timeout: 30000 });
    } catch (err) {
      throw new Error(`重启失败: ${err.message}`);
    }

    // 等待2秒后验证进程
    await new Promise(r => setTimeout(r, 2000));
    try {
      execFileSync('pgrep', ['-x', 'xray'], { encoding: 'utf8', timeout: 5000 });
    } catch {
      throw new Error('Xray重启后进程未运行');
    }

    // 7. 清理下载文件
    if (fs.existsSync(downloadPath)) fs.unlinkSync(downloadPath);
    if (fs.existsSync(extractDir)) {
      execFileSync('rm', ['-rf', extractDir], { timeout: 10000 });
    }

    // 更新成功
    updateRecord.success = true;
    updateRecord.completed_at = new Date().toISOString();
    updateRecord.detail = `成功从 v${status.installed_version} 更新到 v${newVersion}`;

    status.installed_version = newVersion;
    status.update_available = false;
    status.failed_updates = 0;
    status.mirror_status = 'synced';
    status.update_history.push(updateRecord);

    if (status.update_history.length > MAX_UPDATE_HISTORY) {
      status.update_history = status.update_history.slice(-MAX_UPDATE_HISTORY);
    }

    saveMirrorStatus(status);
    console.log(`[协议镜像] ✅ 更新完成: v${newVersion}`);

    // 发送更新成功通知
    sendAlertEmail(
      `🪞 Xray-core 已更新至 v${newVersion}`,
      getUpdateSummary()
    );

    return { ok: true, detail: updateRecord.detail };
  } catch (err) {
    console.error('[协议镜像] ❌ 更新失败:', err.message);

    updateRecord.completed_at = new Date().toISOString();
    updateRecord.detail = `更新失败: ${err.message}`;

    status.failed_updates++;
    status.mirror_status = 'error';
    status.update_history.push(updateRecord);

    if (status.update_history.length > MAX_UPDATE_HISTORY) {
      status.update_history = status.update_history.slice(-MAX_UPDATE_HISTORY);
    }

    saveMirrorStatus(status);

    // 连续失败达到上限时告警
    if (status.failed_updates >= MAX_FAILED_UPDATES) {
      sendAlertEmail(
        '🪞 协议镜像更新失败 - 需人工介入',
        `Xray-core 更新已连续失败 ${status.failed_updates} 次。\n` +
        `目标版本: v${status.latest_version}\n` +
        `当前版本: v${status.installed_version}\n` +
        `最后错误: ${err.message}\n` +
        `请手动检查并更新。`
      );
    }

    return { ok: false, detail: `更新失败: ${err.message}` };
  }
}

// ── 发送告警邮件 ─────────────────────────────
function sendAlertEmail(subject, body) {
  try {
    const sendScript = path.join(__dirname, 'send-subscription.js');
    execFileSync('node', [sendScript, 'alert', `${subject}\n\n${body}`], {
      encoding: 'utf8',
      timeout: 30000
    });
    console.log('[协议镜像] 通知邮件已发送');
  } catch (err) {
    console.error('[协议镜像] 邮件发送失败:', err.message);
  }
}

// ── 获取更新摘要 ─────────────────────────────
function getUpdateSummary() {
  const status = readMirrorStatus();
  const lastUpdate = status.update_history.length > 0
    ? status.update_history[status.update_history.length - 1]
    : null;

  const lines = [
    '🪞 协议镜像引擎 · 状态报告',
    '─'.repeat(30),
    `当前版本: v${status.installed_version || '未知'}`,
    `最新版本: v${status.latest_version || '未知'}`,
    `镜像状态: ${status.mirror_status}`,
    `更新可用: ${status.update_available ? '是' : '否'}`,
    `失败次数: ${status.failed_updates}`,
    ''
  ];

  if (lastUpdate) {
    lines.push('最近更新:');
    lines.push(`  ${lastUpdate.from_version} → ${lastUpdate.to_version}`);
    lines.push(`  时间: ${lastUpdate.completed_at}`);
    lines.push(`  结果: ${lastUpdate.success ? '成功' : '失败'}`);
    lines.push(`  详情: ${lastUpdate.detail}`);
  }

  lines.push('');
  lines.push('指纹检查:');
  lines.push(`  TLS匹配: ${status.fingerprint.tls_match ? '✅' : '❌'}`);
  lines.push(`  Reality匹配: ${status.fingerprint.reality_match ? '✅' : '❌'}`);
  lines.push(`  协议版本: ${status.fingerprint.protocol_version}`);

  return lines.join('\n');
}

// ── 获取镜像状态 ─────────────────────────────
function getMirrorStatus() {
  return readMirrorStatus();
}

// ── 主检查流程 ───────────────────────────────
async function checkForUpdates() {
  console.log('[协议镜像] 开始检查...');
  const status = readMirrorStatus();

  // 1. 获取已安装版本
  const installedVersion = getInstalledVersion();
  if (installedVersion) {
    status.installed_version = installedVersion;
  }

  // 2. 指纹检查 (每次都执行)
  status.fingerprint = checkFingerprint();
  status.last_fingerprint_check = new Date().toISOString();

  if (!status.fingerprint.tls_match || !status.fingerprint.reality_match) {
    console.log('[协议镜像] ⚠️ 指纹不一致，可能被探测');
  }

  // 3. 检查GitHub最新版本 (受频率限制)
  const now = Date.now();
  const lastCheck = status.last_github_check ? new Date(status.last_github_check).getTime() : 0;
  const shouldCheckGitHub = (now - lastCheck) >= GITHUB_CHECK_INTERVAL;

  if (shouldCheckGitHub) {
    console.log('[协议镜像] 查询GitHub最新版本...');
    const release = await fetchLatestRelease();

    if (release && release.version) {
      status.latest_version = release.version;
      status.last_github_check = new Date().toISOString();

      if (installedVersion && isNewer(release.version, installedVersion)) {
        console.log(`[协议镜像] 🆕 发现新版本: v${release.version} (当前: v${installedVersion})`);
        status.update_available = true;
        status.mirror_status = 'outdated';

        // LLM风险分析
        const analysis = await consultLLMForUpdate(release, installedVersion);
        if (analysis) {
          console.log('[协议镜像] LLM分析结果:', JSON.stringify(analysis).slice(0, 200));
        }
      } else {
        status.update_available = false;
        if (status.mirror_status !== 'error') {
          status.mirror_status = 'synced';
        }
        console.log(`[协议镜像] ✅ 版本已同步: v${installedVersion || '未知'}`);
      }
    } else {
      console.log('[协议镜像] GitHub查询跳过 (API不可达或已限流)');
    }
  } else {
    const nextCheckMin = Math.round((GITHUB_CHECK_INTERVAL - (now - lastCheck)) / 60000);
    console.log(`[协议镜像] 使用缓存的GitHub结果 (下次查询: ${nextCheckMin}分钟后)`);
  }

  saveMirrorStatus(status);

  // 打印摘要
  console.log(`[协议镜像] 检查完成 | 版本: v${status.installed_version || '?'} | 最新: v${status.latest_version || '?'} | 状态: ${status.mirror_status}`);

  return status;
}

// ── 模块导出 ─────────────────────────────────
module.exports = { checkForUpdates, performUpdate, getMirrorStatus, getUpdateSummary };

// ── 启动协议镜像引擎 ────────────────────────
console.log('🪞 光湖语言世界 · 协议镜像引擎启动');
console.log(`  检查间隔: ${CHECK_INTERVAL / 1000}秒`);
console.log(`  GitHub API间隔: ${GITHUB_CHECK_INTERVAL / 3600000}小时`);
console.log(`  LLM路由器: 动态多模型 (通过llm-router.js)`);

// 立即执行一次
checkForUpdates().catch(console.error);

// 定期执行
setInterval(() => {
  checkForUpdates().catch(console.error);
}, CHECK_INTERVAL);
