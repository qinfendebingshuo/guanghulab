#!/usr/bin/env node
/**
 * skyeye/hibernation/distributor.js
 * ═══════════════════════════════════════════════
 * 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
 * 📜 Copyright: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════
 *
 * 📦 分布式升级传播引擎
 * 读取升级包中的 soldier_upgrade_manifest，
 * 通过 repository_dispatch 向子仓库分发升级指令。
 *
 * 用法:
 *   node distributor.js [--pack=path/to/upgrade-pack.json]
 *
 * 环境变量:
 *   GITHUB_TOKEN - 用于 API 调用
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');

const UPGRADE_DIR = path.join(__dirname, 'upgrade-packs');
const DIST_DIR    = path.join(__dirname, 'distribution-reports');

// ━━━ 工具函数 ━━━

function getTimestamp() {
  return new Date().toISOString();
}

function getDateStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ━━━ GitHub API dispatch ━━━

function dispatchUpgrade(owner, repo, manifest) {
  return new Promise((resolve, reject) => {
    const token = process.env.GITHUB_TOKEN || process.env.HUB_TOKEN;
    if (!token) {
      console.log(`  ⚠️ 无 GITHUB_TOKEN，跳过 dispatch 到 ${owner}/${repo}`);
      resolve({ target: `${owner}/${repo}`, status: 'skipped', reason: 'no_token' });
      return;
    }

    const payload = JSON.stringify({
      event_type: 'skyeye-upgrade',
      client_payload: {
        template_version: manifest.template_version,
        changes: manifest.changes,
        issued_by: 'skyeye-weekly-hibernation',
        issued_at: getTimestamp()
      }
    });

    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/repos/${owner}/${repo}/dispatches`,
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'skyeye-distributor'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 204 || res.statusCode === 200) {
          resolve({
            target: `${owner}/${repo}`,
            status: 'dispatched',
            dispatched_at: getTimestamp()
          });
        } else {
          resolve({
            target: `${owner}/${repo}`,
            status: 'failed',
            http_status: res.statusCode,
            error: body
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        target: `${owner}/${repo}`,
        status: 'failed',
        error: e.message
      });
    });

    req.write(payload);
    req.end();
  });
}

// ━━━ 主流程 ━━━

async function distributeUpgrades(manifest) {
  const results = [];
  const owner = 'qinfendebingshuo';

  for (const target of manifest.targets) {
    console.log(`  📡 分发升级到: ${owner}/${target}`);
    const result = await dispatchUpgrade(owner, target, manifest);
    results.push(result);
    console.log(`    → ${result.status}`);
  }

  return {
    total: manifest.targets.length,
    success: results.filter(r => r.status === 'dispatched').length,
    failed: results.filter(r => r.status === 'failed').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    details: results
  };
}

async function run() {
  console.log('═══════════════════════════════════════════════');
  console.log('📦 分布式升级传播引擎');
  console.log('═══════════════════════════════════════════════');

  const args = process.argv.slice(2);
  const packArg = args.find(a => a.startsWith('--pack='));

  // 查找升级包
  let upgradePack = null;
  if (packArg) {
    const packPath = packArg.split('=')[1];
    upgradePack = loadJSON(packPath);
  } else {
    // 查找最新升级包
    if (fs.existsSync(UPGRADE_DIR)) {
      const packFiles = fs.readdirSync(UPGRADE_DIR)
        .filter(f => f.startsWith('upgrade-pack-') && f.endsWith('.json'))
        .sort();
      if (packFiles.length > 0) {
        upgradePack = loadJSON(path.join(UPGRADE_DIR, packFiles[packFiles.length - 1]));
      }
    }
  }

  if (!upgradePack || !upgradePack.soldier_upgrade_manifest) {
    console.log('⚠️ 未找到升级包或无 soldier_upgrade_manifest，跳过分发');
    return { status: 'skipped', reason: 'no_manifest' };
  }

  const manifest = upgradePack.soldier_upgrade_manifest;
  console.log(`📋 升级模板版本: ${manifest.template_version}`);
  console.log(`🎯 目标子仓库: ${manifest.targets.length} 个`);
  console.log('');

  const result = await distributeUpgrades(manifest);

  // 写入分发报告
  const report = {
    report_id: `DIST-REPORT-${getDateStr()}`,
    upgrade_pack_id: upgradePack.upgrade_pack_id,
    timestamp: getTimestamp(),
    template_version: manifest.template_version,
    distribution: result
  };

  const reportPath = path.join(DIST_DIR, `dist-report-${getDateStr()}.json`);
  saveJSON(reportPath, report);
  console.log('');
  console.log(`📋 分发报告: ${reportPath}`);
  console.log(`✅ 成功: ${result.success} / 失败: ${result.failed} / 跳过: ${result.skipped}`);

  return report;
}

module.exports = { distributeUpgrades, run };

if (require.main === module) {
  run().catch(console.error);
}
