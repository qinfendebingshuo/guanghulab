/**
 * push-token-alerts.js
 * 
 * 天眼系统调用此脚本读取 token-alert.json
 * 并将告警信息写入主控台 + 公告板
 * 
 * 输出：
 *   - grid-db/notifications/token-alert-{timestamp}.md  → 主控台通知
 *   - grid-db/bulletin/token-alert-{timestamp}.md       → 公告板通知
 * 
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 * 主控: TCS-0002∞ 冰朔
 */

const fs = require('fs');
const path = require('path');

function pushAlerts() {
  const alertPath = path.join(__dirname, '../../grid-db/logs/token-alert.json');
  
  if (!fs.existsSync(alertPath)) {
    console.log('✅ 无告警。');
    return;
  }
  
  const alert = JSON.parse(fs.readFileSync(alertPath, 'utf8'));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // 生成主控台通知
  const dashboardContent = [
    `# ⚠️ Token 续期告警`,
    ``,
    `**时间:** ${alert.time}`,
    `**严重级:** ${alert.severity || 'ALERT'}`,
    `**影响用户:** ${alert.failed_users.join(', ')}`,
    ``,
    `## 描述`,
    alert.message,
    ``,
    `## 需要人类操作`,
    ...(alert.instructions || []).map((s) => s),
    ``,
    `---`,
    `*此告警由 Token 续期引擎自动生成*`
  ].join('\n');
  
  // 写入主控台
  const notifDir = path.join(__dirname, '../../grid-db/notifications');
  if (!fs.existsSync(notifDir)) fs.mkdirSync(notifDir, { recursive: true });
  fs.writeFileSync(path.join(notifDir, `token-alert-${timestamp}.md`), dashboardContent);
  
  // 写入公告板
  const bulletinDir = path.join(__dirname, '../../grid-db/bulletin');
  if (!fs.existsSync(bulletinDir)) fs.mkdirSync(bulletinDir, { recursive: true });
  fs.writeFileSync(path.join(bulletinDir, `token-alert-${timestamp}.md`), dashboardContent);
  
  // 清除已处理的告警文件
  fs.unlinkSync(alertPath);
  
  console.log(`⚠️ 告警已推送到主控台 + 公告板: token-alert-${timestamp}.md`);
}

pushAlerts();
