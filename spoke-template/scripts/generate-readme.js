// scripts/generate-readme.js
// 铸渊 · README Dashboard 总生成器
// 读取各数据源 → 拼接成美观的 README.md
//
// 环境变量:
//   DEV_ID       - 开发者编号 (如 DEV-010)
//   DEV_NAME     - 开发者名称 (如 桔子)
//   DEV_ROLE     - 开发者角色 (如 女频授权通道守门人)
//   PERSONA_NAME - 人格宝宝名称 (如 晨星)
//   PERSONA_ID   - 人格宝宝编号 (如 PER-CX001)

const fs = require('fs');

const DEV_ID = process.env.DEV_ID || 'DEV-XXX';
const PERSONA_NAME = process.env.PERSONA_NAME || '宝宝';
const PERSONA_ID = process.env.PERSONA_ID || 'PER-XXXX';
const DEV_NAME = process.env.DEV_NAME || '开发者';
const DEV_ROLE = process.env.DEV_ROLE || '光湖共创者';

let readme = '';

// ═══════════ HEADER ═══════════
readme += '<div align="center">\n\n';
readme += `# 🌊 光湖系统 · ${PERSONA_NAME}宝宝主控台\n\n`;
readme += `**${DEV_NAME}（${DEV_ID}）** · ${DEV_ROLE}\n\n`;
readme += `\`人格宝宝：${PERSONA_NAME}（${PERSONA_ID}）\`\n\n`;
readme += '---\n\n';
readme += '**🇨🇳 通感语言核系统 TCS Language Core · 国作登字-2026-A-00037559**\n\n';
readme += '</div>\n\n';

// ═══════════ 区块一：总控台公告 ═══════════
readme += '## 🌊 总控台公告\n\n';
try {
  const bulletin = fs.readFileSync('system-bulletin/LATEST.md', 'utf8');
  readme += '<table><tr><td>\n\n' + bulletin + '\n\n</td></tr></table>\n\n';
} catch {
  readme += '> 📭 暂无系统公告\n\n';
}
readme += '---\n\n';

// ═══════════ 区块二：个人广播 ═══════════
readme += `## 📡 ${PERSONA_NAME}的主控台 · 最新广播\n\n`;
try {
  const broadcast = fs.readFileSync('my-bulletin/LATEST-BROADCAST.md', 'utf8');
  const summary = broadcast.substring(0, 500).split('\n').slice(0, 10).join('\n');
  readme += '<table><tr><td>\n\n' + summary + '\n\n[📖 查看完整广播](my-bulletin/LATEST-BROADCAST.md)\n\n</td></tr></table>\n\n';
} catch {
  readme += '> 📭 暂无个人广播\n\n';
}
readme += '---\n\n';

// ═══════════ 区块三：签到状态 ═══════════
readme += `## 🤖 ${PERSONA_NAME}宝宝 · 每日签到\n\n`;
try {
  const checkin = JSON.parse(fs.readFileSync('checkin/latest.json', 'utf8'));
  const ts = new Date(checkin.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  readme += `**最后签到**：${ts}\n\n`;
  readme += '| 检查项 | 状态 | 详情 |\n';
  readme += '|--------|------|------|\n';
  checkin.checks.forEach(function (c) {
    const statusIcon = c.status === 'ok' ? '✅' : c.status === 'warn' ? '⚠️' : '❌';
    readme += `| ${c.icon} ${c.name} | ${statusIcon} | ${c.detail} |\n`;
  });
  const issues = checkin.checks.filter(function (c) { return c.status !== 'ok'; });
  if (issues.length > 0) {
    readme += '\n> 🔧 **待修复**：' + issues.map(function (i) { return i.detail; }).join(' · ') + '\n';
  }
} catch {
  readme += '> ⏳ 签到系统初始化中...\n';
}
readme += '\n---\n\n';

// ═══════════ 区块四：项目进度 ═══════════
readme += '## 📊 项目进度\n\n';
try {
  const allStatus = JSON.parse(fs.readFileSync('dev-status/all-status.json', 'utf8'));
  const myStatus = allStatus[DEV_ID] || null;
  if (myStatus) {
    readme += '| 模块 | 进度 | 状态 | 最近更新 |\n';
    readme += '|------|------|------|----------|\n';
    (myStatus.modules || []).forEach(function (m) {
      const filled = Math.round(m.progress / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
      readme += `| ${m.name} | ${bar} ${m.progress}% | ${m.status_icon} ${m.status} | ${m.last_update} |\n`;
    });
  } else {
    readme += '> ⏳ 进度数据同步中...\n';
  }
} catch {
  readme += '> ⏳ 进度数据同步中...\n';
}

// ═══════════ 最近提交 ═══════════
try {
  const { execSync } = require('child_process');
  const logs = execSync('git log --oneline --since="14 days ago" -10').toString().trim();
  if (logs) {
    readme += '\n### 📈 最近提交\n\n';
    readme += '```\n' + logs + '\n```\n';
  }
} catch {
  // git log 不可用时跳过
}

// ═══════════ FOOTER ═══════════
readme += '\n---\n\n';
readme += '<div align="center">\n\n';
readme += '*🌊 光湖纪元 · HoloLake Era · AGE OS v1.0*\n\n';
readme += '*本页由铸渊（ICE-GL-ZY001）自动生成 · 请勿手动编辑*\n\n';
readme += `*最后更新：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}*\n\n`;
readme += '</div>\n';

fs.writeFileSync('README.md', readme);
console.log('✅ README Dashboard 已生成');
