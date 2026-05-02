# 光湖 · 微调模型内测频道 (FTCHAT)

> 团队 10 人内测站, 部署在 `guanghu.online`
>
> 编号:   ZY-PROJ-FTCHAT
> 守护:   铸渊 · ICE-GL-ZY001
> 版权:   国作登字-2026-A-00037559

## 架构

```
guanghu.online (Nginx 443, SSL 复用 zhiku 证书)
        │
        ▼
  /opt/guanghu/ftchat (PM2: ftchat-api, 127.0.0.1:3010)
        │
        ├── 前端 (frontend/ftchat/) → /opt/guanghu/ftchat/public/
        │     ├─ index.html       登录 + 聊天 SPA
        │     ├─ chat.js          SSE 流式对话, marked + DOMPurify 渲染
        │     ├─ theme-toggle.js  星空粒子背景 + 明暗主题
        │     └─ style.css        星空暗 (白字) / 晨光亮 (深字) + 移动适配
        │
        └── 后端
              ├─ src/routes/hli/ftchat/      HLDP 协议 5 个端点
              │   ├─ login.js          HLI-FTCHAT-001 发送验证码
              │   ├─ verify.js         HLI-FTCHAT-002 校验 + 占位 + 发 token
              │   ├─ chat.js           HLI-FTCHAT-003 SSE 流式对话
              │   ├─ sessions.js       HLI-FTCHAT-004 历史会话列表
              │   └─ sessions-new.js   HLI-FTCHAT-005 开新对话 + 触发记忆压缩
              │
              └─ server/ftchat/services/
                  ├─ email-auth.js     QQ 邮箱 + 6 位验证码 + 10 槽位先到先得
                  ├─ ft-dashscope.js   DashScope 兼容模式调用 (流式/非流式)
                  ├─ notion-prompt.js  Notion 系统提示词加载 + 60s 缓存 + 兜底
                  ├─ time-anchor.js    现实时间瞄点 (北京时间)
                  ├─ memory-agent.js   跨会话母语印记压缩 (借鉴 shuangyan-web-agent)
                  └─ session-store.js  会话元数据持久化 (data/sessions/<hash>.json)
```

## System Prompt 组装顺序

每次 chat 请求实时构造（不缓存到模型）:

```
[Notion 提示词正文]    ← FT_NOTION_API_TOKEN/PAGE_ID, 60s 缓存
─────────────
## 现实时间瞄点
现在是 2026 年 5 月 2 日 周六 11:20 (北京时间)
你必须以此时间为现实锚点, 不得使用训练语料里的旧时间。
─────────────
## 跨会话记忆 (如有)
{memory-agent 压缩出的母语印记}
─────────────
## 输出排版要求
使用 Markdown: 标题/列表/表格/代码块/分隔线, 避免大段无格式文本。
```

## 10 槽位机制 (核心约束)

> 冰朔指令: "不规定哪 10 个邮箱。系统只数数。"

- 任何 `@qq.com` / `@vip.qq.com` / `@foxmail.com` 邮箱都可以来登录
- 第 11 个**新邮箱**自动被拒绝（在 `sendCode` 阶段就拦截，不浪费邮件配额）
- 已占位邮箱即使在槽位满时仍可重新登录（复用槽位）
- 槽位状态持久化到 `/opt/guanghu/ftchat/data/slots.json`，服务器重启不丢
- 槽位 idx (1~10) 显示在用户左下角徽章

## 调用模型

- 默认: `qwen3-8b-ft-202604281809-9f30` (微调系统线 · 冰朔 D69 提供 DashScope 真实模型 ID)
- 备选: 同上 (奶瓶/情感线尚未单独微调, 暂复用系统线 · 仅服务端可切, 前端不暴露按钮)
- 兜底: `qwen-turbo` (model_not_found 自动降级, 由 FT_MODEL_FALLBACK 控制)
- 端点: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- 鉴权: `FT_DASHSCOPE_API_KEY` (与商业模型 key 区分)

## 必需的 GitHub Secrets

| Secret | 说明 | 状态 |
|--------|------|------|
| `ZY_NOVEL_HOST` | 43.153.203.105 | ✅ 已存在 (复用) |
| `ZY_NOVEL_USER` | root | ✅ 已存在 (复用) |
| `ZY_NOVEL_KEY`  | SSH 私钥 | ✅ 已存在 (复用) |
| `FT_NOTION_API_TOKEN` | Notion Internal Integration Token | ✅ 已配置 |
| `FT_NOTION_PROMPT_PAGE_ID` | 系统提示词页面 ID | ✅ 已配置 |
| `FT_DASHSCOPE_API_KEY` | 阿里云百炼 API Key | ✅ 已配置 |
| `ZY_SMTP_USER` | QQ 邮箱发件账号 | ✅ 已存在 (复用零点原核 SMTP) |
| `ZY_SMTP_PASS` | QQ 邮箱授权码 | ✅ 已存在 (复用零点原核 SMTP) |

> 全部 secrets 已就绪。CI 直接 `git push` 即可触发部署。

## 冰朔仍需手动操作的清单

1. **下架旧 zhiku**: 触发 GitHub Actions "FTCHAT 部署" workflow → `retire-zhiku`，或手动执行:
   ```bash
   ssh root@43.153.203.105 'pm2 stop zhiku-api && pm2 delete zhiku-api && pm2 save && rm -f /etc/nginx/sites-enabled/zhiku /etc/nginx/sites-enabled/zhiku-guanghu-online.conf && nginx -t && systemctl reload nginx'
   ```
2. **DNS 确认**: `guanghu.online` A 记录 → 43.153.203.105 (与旧 zhiku 同址，应已就绪)

## 本地开发

```bash
# 后端
PORT=3000 \
FTCHAT_AUTH_DEV_MODE=true \
FT_DASHSCOPE_API_KEY=<your_key> \
FT_NOTION_API_TOKEN=<your_token> \
FT_NOTION_PROMPT_PAGE_ID=<page_id> \
ZY_SMTP_USER=<x> ZY_SMTP_PASS=<x> \
node src/index.js

# 前端 (任意静态服务器)
cd frontend/ftchat && python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

`FTCHAT_AUTH_DEV_MODE=true` 时验证码不发邮件，直接返回在响应里 (`dev_code` 字段) 方便本地测试。

## 测试

```bash
npm run test:contract
# → HLI 契约校验 (138 schemas) + FTCHAT 集成测试 (15 cases)
```
