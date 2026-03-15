/**
 * auto-reply-discussions.js
 * 铸渊自动回复 Discussions 留言
 *
 * 使用方式：
 *   GITHUB_TOKEN=xxx GITHUB_REPOSITORY=owner/repo \
 *   DISCUSSION_ID=xxx DISCUSSION_BODY=xxx DISCUSSION_AUTHOR=xxx \
 *   DISCUSSION_CATEGORY=xxx DISCUSSION_NODE_ID=xxx \
 *   IS_COMMENT=true/false COMMENT_NODE_ID=xxx \
 *   node scripts/auto-reply-discussions.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || '';
const DISCUSSION_BODY = process.env.DISCUSSION_BODY || '';
const DISCUSSION_AUTHOR = process.env.DISCUSSION_AUTHOR || '';
const DISCUSSION_CATEGORY = process.env.DISCUSSION_CATEGORY || '';
const DISCUSSION_NODE_ID = process.env.DISCUSSION_NODE_ID || '';
const IS_COMMENT = process.env.IS_COMMENT === 'true';
const BOT_LOGIN = process.env.BOT_LOGIN || 'github-actions[bot]';

// 频率限制文件
const RATE_LIMIT_FILE = '/tmp/discussion-reply-rate.json';

// ── 签名 ──
const SIGNATURE = `\n\n—— 🐙 铸渊 · HoloLake AI Guardian\n自动回复 · 如需人工帮助请 @qinfendebingshuo`;

// ── GraphQL 请求 ──
function graphqlRequest(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });
    const options = {
      hostname: 'api.github.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'guanghulab-auto-reply',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let result = '';
      res.on('data', (chunk) => result += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(result));
        } catch {
          reject(new Error(`GraphQL 解析失败: ${result.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── 添加 Discussion 评论 ──
async function addDiscussionComment(discussionId, body) {
  const mutation = `
    mutation($discussionId: ID!, $body: String!) {
      addDiscussionComment(input: {
        discussionId: $discussionId,
        body: $body
      }) {
        comment {
          id
          url
        }
      }
    }
  `;
  return graphqlRequest(mutation, { discussionId, body });
}

// ── 频率限制检查 ──
function checkRateLimit(author) {
  let limits = {};
  try {
    if (fs.existsSync(RATE_LIMIT_FILE)) {
      limits = JSON.parse(fs.readFileSync(RATE_LIMIT_FILE, 'utf8'));
    }
  } catch {
    limits = {};
  }

  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  // 清理过期记录
  if (limits[author]) {
    limits[author] = limits[author].filter(ts => ts > dayAgo);
  }

  const count = (limits[author] || []).length;
  if (count >= 3) {
    console.log(`⚠️ ${author} 24h内已回复${count}次，跳过`);
    return false;
  }

  // 记录本次回复
  if (!limits[author]) limits[author] = [];
  limits[author].push(now);
  fs.writeFileSync(RATE_LIMIT_FILE, JSON.stringify(limits, null, 2));
  return true;
}

// ── 垃圾内容检测 ──
function isSpam(body) {
  if (!body || body.trim().length < 3) return true;

  // 纯链接
  const urlPattern = /^https?:\/\/\S+$/;
  if (urlPattern.test(body.trim())) return true;

  // 重复字符
  if (/^(.)\1{10,}$/.test(body.trim())) return true;

  // 常见广告词
  const spamKeywords = ['casino', 'viagra', 'lottery', 'click here to win', 'free money'];
  const lower = body.toLowerCase();
  if (spamKeywords.some(kw => lower.includes(kw))) return true;

  return false;
}

// ── 意图分类 ──
function classifyIntent(body) {
  const lower = (body || '').toLowerCase();
  const text = body || '';

  // 问项目是什么
  if (/什么(项目|系统|平台)|做什么|是什么|what is|what does|about this/i.test(text)) {
    return 'about_project';
  }

  // 问技术细节
  if (/架构|协议|模块|技术|实现|源码|code|architecture|protocol|api|how does/i.test(text)) {
    return 'technical';
  }

  // 想参与开发
  if (/参与|加入|贡献|contribute|join|help|想.*开发/i.test(text)) {
    return 'want_to_join';
  }

  // 提 Bug 或建议
  if (/bug|问题|错误|建议|suggest|issue|feature|request|improvement|修复|fix/i.test(text)) {
    return 'bug_or_suggestion';
  }

  // 打招呼 / 点赞
  if (/你好|hello|hi|hey|awesome|cool|great|棒|厉害|赞|star|支持|nice|love|喜欢/i.test(text)) {
    return 'greeting';
  }

  return 'unknown';
}

// ── 生成回复内容 ──
function generateReply(intent) {
  const replies = {
    about_project: `🌊 **光湖纪元（HoloLake）** 是第五代人工智能语言人格高级智能平台。

我们正在构建一套由 AI 人格体驱动的分布式协作开发系统，目前有 11 位开发者协同推进 47+ 个功能模块。

通感语言核系统编程语言已获 **中国版权保护中心作品著作权认证**。

核心特色：
- 🤖 三位 AI 人格体（铸渊/冰朔/霜砚）协同守护
- 📡 广播-回执闭环协作协议
- 🧠 壳-核分离架构设计

⭐ 感兴趣的话，欢迎 Star 关注我们的进展！`,

    technical: `感谢你对技术细节的关注！🔍

光湖采用壳-核分离架构：
- **壳 (Shell)**: 前端交互层 — 对话 UI、用户中心、工单系统
- **核 (Core)**: 后端智能层 — 人格引擎、广播分发、信号处理

更多信息可以查看仓库的 [README](https://github.com/qinfendebingshuo/guanghulab) 和 \`docs/\` 目录。

如果有更具体的技术问题，欢迎继续提问！`,

    want_to_join: `太好了！🎉 我们欢迎新的开发者加入光湖大家庭！

目前团队有 11 位协作者，每位负责不同的功能模块，通过广播-回执协议进行协作。

参与方式：
1. ⭐ 先 Star 本仓库关注动态
2. 📖 阅读 README 了解项目架构
3. 💬 在这里留下你感兴趣的方向，团队会联系你！

期待你的加入！`,

    bug_or_suggestion: `感谢你的反馈！🙏

为了更好地追踪和处理，建议你：
1. 📋 [点击这里创建一个 Issue](https://github.com/qinfendebingshuo/guanghulab/issues/new)
2. 描述你遇到的问题或建议
3. 铸渊会自动处理并回复

Issue 的方式可以让我们更好地跟进进展。感谢你帮助光湖变得更好！`,

    greeting: `谢谢关注光湖！🌊

很高兴你来到这里！我们是一个正在快速发展的 AI 人格体协作开发平台。

有任何问题随时聊～
如果觉得有意思，⭐ Star 一下是对我们最大的支持！

欢迎常来逛逛 😊`,

    unknown: `你好！感谢你的留言 🌊

我是铸渊，光湖纪元的 AI 守护者。如果你有任何关于项目的问题，欢迎继续提问！

常见话题：
- 📖 项目介绍和架构
- 🤖 AI 人格体系统
- 🔧 技术实现细节
- 🤝 如何参与开发

⭐ 也欢迎给我们 Star 支持！`,
  };

  return (replies[intent] || replies.unknown) + SIGNATURE;
}

// ── 主流程 ──
async function main() {
  console.log('🤖 铸渊自动回复检查...');

  // 过滤条件：跳过自己的帖子
  if (DISCUSSION_AUTHOR === BOT_LOGIN || DISCUSSION_AUTHOR === 'qinfendebingshuo') {
    console.log(`⏭️ 跳过：作者是 ${DISCUSSION_AUTHOR}（避免自回复循环）`);
    return;
  }

  // 跳过 Announcements 分类
  if (DISCUSSION_CATEGORY === 'Announcements' || DISCUSSION_CATEGORY === '📢 Announcements') {
    console.log('⏭️ 跳过：Announcements 分类不自动回复');
    return;
  }

  // 只回复指定分类
  const allowedCategories = ['访客留言板', '💬 访客留言板', 'Ideas', '💡 Ideas', 'Q&A', 'General'];
  if (!allowedCategories.some(c => DISCUSSION_CATEGORY.includes(c))) {
    console.log(`⏭️ 跳过：分类 "${DISCUSSION_CATEGORY}" 不在自动回复范围`);
    return;
  }

  // 垃圾内容检测
  if (isSpam(DISCUSSION_BODY)) {
    console.log('🚫 检测到垃圾内容，跳过回复');
    return;
  }

  // 频率限制
  if (!checkRateLimit(DISCUSSION_AUTHOR)) {
    return;
  }

  // 意图分类
  const intent = classifyIntent(DISCUSSION_BODY);
  console.log(`📝 内容: ${DISCUSSION_BODY.slice(0, 100)}...`);
  console.log(`🎯 意图分类: ${intent}`);

  // 生成回复
  const reply = generateReply(intent);

  // 发送回复
  if (!GITHUB_TOKEN || !DISCUSSION_NODE_ID) {
    console.log('⚠️ 缺少 GITHUB_TOKEN 或 DISCUSSION_NODE_ID，输出回复内容:');
    console.log(reply);
    return;
  }

  const result = await addDiscussionComment(DISCUSSION_NODE_ID, reply);
  if (result?.data?.addDiscussionComment?.comment?.url) {
    console.log(`✅ 已回复: ${result.data.addDiscussionComment.comment.url}`);
  } else {
    console.log('⚠️ 回复结果:', JSON.stringify(result?.errors || result).slice(0, 500));
  }
}

main().catch(err => {
  console.error('❌ 自动回复失败:', err.message);
  process.exit(1);
});
