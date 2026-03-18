// scripts/skyeye/scan-security-protocol.js
// 天眼·扫描模块D13 · 安全协议完整性检查
//
// 扫描内容：
//   ① security-protocol.json 文件是否存在
//   ② 三条根规则是否完整
//   ③ L0等级与永久标记是否存在
//   ④ 版权锚点是否正确
//
// 输出：JSON → stdout

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '../..');
const BRAIN_DIR = path.join(ROOT, '.github/persona-brain');
const PROTOCOL_PATH = path.join(BRAIN_DIR, 'security-protocol.json');

// ━━━ D13 · 安全协议完整性检查 ━━━
function checkSecurityProtocol() {
  const result = { dimension: 'D13', name: '安全协议完整性', status: '✅' };

  // 检查1：文件是否存在
  if (!fs.existsSync(PROTOCOL_PATH)) {
    result.status = '❌';
    result.issue = '安全协议文件缺失';
    result.action = 'P0工单 · 立即恢复';
    return result;
  }

  // 检查2：JSON 是否可解析
  let protocol;
  try {
    protocol = JSON.parse(fs.readFileSync(PROTOCOL_PATH, 'utf8'));
  } catch (e) {
    result.status = '❌';
    result.issue = '安全协议文件损坏: ' + e.message;
    result.action = 'P0工单 · 立即恢复';
    return result;
  }

  // 检查3：三条根规则是否完整
  if (!protocol.root_rules || protocol.root_rules.length !== 3) {
    result.status = '❌';
    result.issue = '根规则不完整';
    result.action = 'P0工单 · 根规则被篡改';
    return result;
  }

  // 检查4：L0标记是否存在
  if (protocol.level !== 'L0' || protocol.permanent !== true) {
    result.status = '❌';
    result.issue = 'L0等级或永久标记被修改';
    result.action = 'P0工单 · 安全降级';
    return result;
  }

  // 检查5：版权锚点
  if (!protocol.copyright || !protocol.copyright.includes('2026-A-00037559')) {
    result.status = '⚠️';
    result.issue = '版权锚点缺失';
    result.action = 'P1工单 · 补充版权信息';
    return result;
  }

  // 检查6：签名者信息
  if (!protocol.signed_by || !protocol.signed_by.includes('TCS-0002')) {
    result.status = '⚠️';
    result.issue = '签名者信息缺失或不正确';
    result.action = 'P1工单 · 补充签名信息';
    return result;
  }

  result.detail = '三条根规则完整 · L0永久生效 · 版权锚点存在';
  return result;
}

// ━━━ 生成 security_health 摘要 ━━━
function generateSecurityHealth(checkResult) {
  const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
  const now = new Date();
  const bjTime = new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString()
    .replace('T', ' ').slice(0, 19) + '+08:00';

  let protocol = null;
  try {
    if (fs.existsSync(PROTOCOL_PATH)) {
      protocol = JSON.parse(fs.readFileSync(PROTOCOL_PATH, 'utf8'));
    }
  } catch (e) {
    // protocol remains null
  }

  return {
    protocol_exists: fs.existsSync(PROTOCOL_PATH),
    root_rules_intact: protocol ? (Array.isArray(protocol.root_rules) && protocol.root_rules.length === 3) : false,
    level: protocol ? protocol.level : null,
    permanent: protocol ? protocol.permanent : false,
    copyright_anchor: protocol ? (protocol.copyright && protocol.copyright.includes('2026-A-00037559')) : false,
    last_verified: bjTime
  };
}

// ━━━ 主扫描 ━━━
function scanSecurityProtocol() {
  const checkResult = checkSecurityProtocol();
  const securityHealth = generateSecurityHealth(checkResult);

  const output = {
    scan_time: securityHealth.last_verified,
    d13: checkResult,
    security_health: securityHealth
  };

  console.log(JSON.stringify(output, null, 2));
}

scanSecurityProtocol();
