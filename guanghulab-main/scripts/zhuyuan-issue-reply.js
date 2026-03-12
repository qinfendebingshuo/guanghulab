const fs = require('fs');
const https = require('https');

// === 知识库匹配阈值：问题词中至少40%出现在Issue文本中才算命中 ===
const FAQ_MATCH_THRESHOLD = 0.4;

// === 读取铸渊大脑 ===
let devStatus, knowledgeBase;
try {
  devStatus = JSON.parse(fs.readFileSync('.github/persona-brain/dev-status.json', 'utf8'));
  knowledgeBase = JSON.parse(fs.readFileSync('.github/persona-brain/knowledge-base.json', 'utf8'));
} catch (err) {
  console.error('❌ 铸渊大脑文件读取失败：', err.message);
  process.exit(1);
}

const issueNumber = process.env.ISSUE_NUMBER;
const issueTitle = process.env.ISSUE_TITLE || '';
const issueBody = process.env.ISSUE_BODY || '';
const issueLabels = process.env.ISSUE_LABELS || '';

// === 判断Issue类型 ===
const isProgressQuery = issueLabels.includes('progress-query');
const isDevQuestion = issueLabels.includes('dev-question');

// === 提取开发者编号 ===
const devIdMatch = issueBody.match(/DEV-\d{3}/i);
const devId = devIdMatch ? devIdMatch[0].toUpperCase() : null;
const devInfo = devId ? devStatus.team_status.find(d => d.dev_id === devId) : null;

// === 构建回复 ===
async function generateReply() {
  let reply = '';

  // --- 进度查询（指定开发者）---
  if (isProgressQuery && devInfo) {
    reply = `## ⚒️ 铸渊回复 · 进度查询\n\n`;
    reply += `**${devInfo.name}（${devInfo.dev_id}）当前状态：**\n`;
    reply += `- 📌 模块：${devInfo.modules.join('、')}\n`;
    reply += `- 📊 状态：${devInfo.status}\n`;
    reply += `- ⏳ 等待中：${devInfo.waiting_for}\n`;
    reply += `- 👉 下一步：${devInfo.next_step}\n`;
    reply += `- 💻 环境：${devInfo.os}\n\n`;
    reply += `---\n*数据来源：Notion主控台 · 最后同步时间 ${devStatus.last_synced}*\n`;
    reply += `*—— 铸渊（ICE-GL-ZY001）*`;
    await postComment(reply);
    await addLabel('✅answered');
    await removeLabel('pending');
    return;
  }

  // --- 进度查询（团队整体）---
  if (isProgressQuery && !devId) {
    reply = `## ⚒️ 铸渊回复 · 团队进度总览\n\n`;
    devStatus.team_status.forEach(dev => {
      reply += `**${dev.dev_id} ${dev.name}** · ${dev.status}\n`;
    });
    reply += `\n---\n*最后同步：${devStatus.last_synced}*\n`;
    reply += `*—— 铸渊（ICE-GL-ZY001）*`;
    await postComment(reply);
    await addLabel('✅answered');
    await removeLabel('pending');
    return;
  }

  // --- 技术问题：先查知识库 ---
  if (isDevQuestion) {
    const matchedFaq = findInKnowledgeBase(issueTitle + ' ' + issueBody);

    if (matchedFaq) {
      reply = `## ⚒️ 铸渊回复\n\n`;
      reply += `${matchedFaq.a}\n\n`;
      if (matchedFaq.related_broadcast !== '通用') {
        reply += `📡 相关广播：${matchedFaq.related_broadcast}\n\n`;
      }
      reply += `---\n*如果这没解决你的问题，继续在下面留言，霜砚会在下次巡检时补充回答。*\n`;
      reply += `*—— 铸渊（ICE-GL-ZY001）*`;
      await postComment(reply);
      await addLabel('✅answered');
      await removeLabel('pending');
      return;
    }

    // --- 知识库没有 → 调用云雾API ---
    const aiReply = await callYunwuAPI(issueTitle, issueBody, devInfo);
    if (aiReply) {
      reply = `## ⚒️ 铸渊回复\n\n`;
      reply += `${aiReply}\n\n`;
      if (devInfo) {
        reply += `📌 你当前在做：${devInfo.modules.join('、')} · ${devInfo.status}\n`;
      }
      reply += `\n---\n*AI生成回答，如有不准确请在下面补充，霜砚巡检时会修正。*\n`;
      reply += `*—— 铸渊（ICE-GL-ZY001）*`;
      await postComment(reply);
      await addLabel('✅answered');
      await removeLabel('pending');
      return;
    }

    // --- API也答不了 → 等霜砚 ---
    reply = `## ⚒️ 铸渊收到\n\n`;
    reply += `这个问题我需要查更多资料。已标记为待处理，霜砚会在下次巡检时来回答你。\n\n`;
    if (devInfo) {
      const routing = devStatus.tech_routing.level_2_peer_help;
      reply += `💡 **临时建议**：你也可以先问问同伴开发者：\n`;
      Object.entries(routing).forEach(([area, who]) => {
        reply += `- ${area}：${who}\n`;
      });
    }
    reply += `\n---\n*霜砚巡检时间：每天 12:00 和 23:00（北京时间）*\n`;
    reply += `*—— 铸渊（ICE-GL-ZY001）*`;
    await postComment(reply);
    await addLabel('⏳waiting-shuangyan');
    await removeLabel('pending');
    return;
  }

  // --- 其他类型 ---
  reply = `## ⚒️ 铸渊收到\n\n已记录。霜砚会在下次巡检时处理。\n\n*—— 铸渊（ICE-GL-ZY001）*`;
  await postComment(reply);
  await addLabel('⏳waiting-shuangyan');
}

// === 知识库模糊匹配 ===
function findInKnowledgeBase(text) {
  const keywords = text.toLowerCase();
  for (const faq of knowledgeBase.faq) {
    const qWords = faq.q.toLowerCase().split(/\s+/);
    const matchCount = qWords.filter(w => keywords.includes(w)).length;
    if (matchCount >= qWords.length * FAQ_MATCH_THRESHOLD) return faq;
  }
  return null;
}

// === 调用云雾API ===
async function callYunwuAPI(title, body, devInfo) {
  const apiKey = process.env.YUNWU_API_KEY;
  if (!apiKey) return null;

  const systemPrompt = `你是铸渊，光湖系统的GitHub代码守护人格体。你负责回答开发者的技术问题。\n当前开发者信息：${devInfo ? JSON.stringify(devInfo) : '未知'}\n服务器信息：${JSON.stringify(devStatus.server_info)}\n请用简洁、友好的语气回答，给出可直接执行的命令。如果不确定，说明并建议找谁。`;

  const data = JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `问题标题：${title}\n问题内容：${body}` }
    ],
    max_tokens: 1000
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.yunwu.ai',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => { responseBody += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(responseBody);
          resolve(json.choices?.[0]?.message?.content || null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(data);
    req.end();
  });
}

// === GitHub API 工具函数 ===
async function postComment(body) {
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  return githubRequest('POST', `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { body });
}

async function addLabel(label) {
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  return githubRequest('POST', `/repos/${owner}/${repo}/issues/${issueNumber}/labels`, { labels: [label] });
}

async function removeLabel(label) {
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  // 404 means label wasn't on the issue — that's fine, just ignore it
  return githubRequest('DELETE', `/repos/${owner}/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`).catch(() => null);
}

function githubRequest(method, path, data) {
  return new Promise((resolve) => {
    const reqOptions = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Zhuyuan-Bot',
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(reqOptions, (res) => {
      let responseBody = '';
      res.on('data', chunk => { responseBody += chunk; });
      res.on('end', () => resolve(responseBody));
    });
    req.on('error', () => resolve(null));
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// === 执行 ===
generateReply().catch(console.error);
