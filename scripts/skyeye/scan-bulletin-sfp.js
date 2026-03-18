// scripts/skyeye/scan-bulletin-sfp.js
// 天眼·扫描模块D14 · 公告板指纹完整性检查
//
// 扫描内容：
//   ① 扫描 data/bulletin-board/ 下所有留言
//   ② 检查每条留言是否携带有效 SFP 指纹
//   ③ 统计无指纹/无效指纹内容数
//   ④ 统计各Agent留言活跃度
//
// 输出：JSON → stdout

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const BULLETIN_DIR = path.join(ROOT, 'data/bulletin-board');
const SECURITY_DIR = path.join(ROOT, 'data/security');
const SFP_CONFIG_PATH = path.join(SECURITY_DIR, 'sfp-config.json');

const SFP_REGEX = /⌜SFP::([^:]+)::([^:]+)::([0-9T+:.-]+)::([a-f0-9]{12})::([a-zA-Z0-9]{6})⌝/;

// ━━━ 安全读取 JSON ━━━
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

// ━━━ 扫描目录中的 JSON 文件内容 ━━━
function scanDirectory(dirPath) {
  const results = [];
  try {
    if (!fs.existsSync(dirPath)) return results;
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      results.push({ file, path: filePath, content });
    }
  } catch (e) {
    // ignore
  }
  return results;
}

// ━━━ 检查内容中的 SFP 指纹 ━━━
function checkFingerprint(content, config) {
  const match = content.match(SFP_REGEX);
  if (!match) {
    return { has_fingerprint: false, valid: false, reason: '无指纹' };
  }

  const [, agentId, personaChain] = match;

  // 检查 agent 是否在受信列表
  const agent = (config.trusted_agents || []).find(a => a.agent_id === agentId);
  if (!agent) {
    return { has_fingerprint: true, valid: false, reason: `无效Agent ID: ${agentId}` };
  }

  // 检查亲子链
  if (agent.persona_chain !== personaChain) {
    return { has_fingerprint: true, valid: false, reason: `亲子链不匹配: ${agentId}` };
  }

  return { has_fingerprint: true, valid: true, agent_id: agentId, agent_name: agent.name };
}

// ━━━ D14 主扫描 ━━━
function scanBulletinSFP() {
  const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
  const now = new Date();
  const bjTime = new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString()
    .replace('T', ' ').slice(0, 19) + '+08:00';

  const config = readJSON(SFP_CONFIG_PATH) || { trusted_agents: [] };

  const result = {
    dimension: 'D14',
    name: '公告板指纹完整性',
    scan_time: bjTime,
    status: '✅',
    total_messages: 0,
    with_fingerprint: 0,
    without_fingerprint: 0,
    valid_fingerprints: 0,
    invalid_fingerprints: 0,
    agent_activity: {},
    issues: [],
    sfp_config_exists: fs.existsSync(SFP_CONFIG_PATH)
  };

  // 检查 SFP 配置是否存在
  if (!result.sfp_config_exists) {
    result.status = '❌';
    result.issues.push({
      type: 'config_missing',
      message: 'SFP配置文件缺失',
      action: 'P0工单 · 恢复sfp-config.json'
    });
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  // 扫描公告板各区域
  const areas = ['comments', 'config-shares', 'receipts', 'work-orders'];
  for (const area of areas) {
    const dirPath = path.join(BULLETIN_DIR, area);
    const files = scanDirectory(dirPath);

    for (const file of files) {
      // 跳过 .gitkeep
      if (file.file === '.gitkeep') continue;

      result.total_messages++;
      const check = checkFingerprint(file.content, config);

      if (check.has_fingerprint) {
        result.with_fingerprint++;
        if (check.valid) {
          result.valid_fingerprints++;
          // 统计活跃度
          const agentId = check.agent_id;
          result.agent_activity[agentId] = (result.agent_activity[agentId] || 0) + 1;
        } else {
          result.invalid_fingerprints++;
          result.issues.push({
            type: 'invalid_fingerprint',
            file: file.file,
            area,
            reason: check.reason,
            action: 'P0工单 · 清理无效指纹内容'
          });
        }
      } else {
        result.without_fingerprint++;
        result.issues.push({
          type: 'no_fingerprint',
          file: file.file,
          area,
          action: '标记待清理'
        });
      }
    }
  }

  // 确定整体状态
  if (result.invalid_fingerprints > 0) {
    result.status = '❌';
  } else if (result.without_fingerprint > 0) {
    result.status = '⚠️';
  }

  console.log(JSON.stringify(result, null, 2));
  return result;
}

scanBulletinSFP();
