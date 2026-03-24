#!/usr/bin/env node
/**
 * scripts/apply-skyeye-upgrade.js
 * ═══════════════════════════════════════════════
 * 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
 * 📜 Copyright: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════
 *
 * 子仓库小兵 · 自动应用天眼下发的升级
 * 指令编号: ZY-HIBERNATION-2026-0324-001-B
 *
 * 用法:
 *   node apply-skyeye-upgrade.js --template-version=v2026-W13 --issued-at=...
 */

'use strict';

const fs   = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx > -1) {
        result[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      }
    }
  }
  return result;
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

function applyUpgrade(args) {
  const results = [];
  const brainDir = path.join(process.cwd(), '.github', 'persona-brain');

  // 记录升级信息
  const upgradeRecord = {
    template_version: args['template-version'] || 'unknown',
    issued_at: args['issued-at'] || new Date().toISOString(),
    applied_at: new Date().toISOString(),
    changes_applied: []
  };

  // 读取 changes（从 stdin 或 env）
  let changes = [];
  try {
    const changesEnv = process.env.UPGRADE_CHANGES;
    if (changesEnv) {
      changes = JSON.parse(changesEnv);
    }
  } catch (e) {
    console.log('⚠️ 无法解析 UPGRADE_CHANGES，使用默认处理');
  }

  for (const change of changes) {
    try {
      switch (change.type) {
        case 'checkin_schedule': {
          const wfPath = path.join(process.cwd(), '.github', 'workflows', 'skyeye-wake.yml');
          if (fs.existsSync(wfPath)) {
            let content = fs.readFileSync(wfPath, 'utf8');
            if (change.new_cron) {
              content = content.replace(/cron:\s*"[^"]+"/g, `cron: "${change.new_cron}"`);
              fs.writeFileSync(wfPath, content, 'utf8');
              results.push({ type: change.type, status: 'applied' });
              upgradeRecord.changes_applied.push(`checkin_schedule → ${change.new_cron}`);
            }
          } else {
            results.push({ type: change.type, status: 'skipped', reason: 'workflow not found' });
          }
          break;
        }

        case 'guard_config': {
          const configPath = path.join(brainDir, 'skyeye-config.json');
          let config = loadJSON(configPath) || {};
          if (change.field && change.new_value !== undefined) {
            config[change.field] = change.new_value;
            saveJSON(configPath, config);
            results.push({ type: change.type, status: 'applied' });
            upgradeRecord.changes_applied.push(`guard_config.${change.field} → ${change.new_value}`);
          }
          break;
        }

        case 'self_awareness_update': {
          const awarenessPath = path.join(brainDir, 'self-awareness.json');
          let awareness = loadJSON(awarenessPath) || {};
          if (change.updates) {
            Object.assign(awareness, change.updates);
            saveJSON(awarenessPath, awareness);
            results.push({ type: change.type, status: 'applied' });
            upgradeRecord.changes_applied.push('self_awareness updated');
          }
          break;
        }

        default:
          results.push({ type: change.type, status: 'skipped', reason: 'unknown change type' });
      }
    } catch (e) {
      results.push({ type: change.type, status: 'error', error: e.message });
    }
  }

  // 写入升级记录
  upgradeRecord.results = results;
  upgradeRecord.status = results.some(r => r.status === 'error') ? 'partial' : 'complete';
  saveJSON(path.join(brainDir, 'last-upgrade.json'), upgradeRecord);

  console.log(`✅ 升级应用完成: ${results.filter(r => r.status === 'applied').length} 项已应用`);
  return upgradeRecord;
}

if (require.main === module) {
  const args = parseArgs();
  applyUpgrade(args);
}

module.exports = { applyUpgrade };
