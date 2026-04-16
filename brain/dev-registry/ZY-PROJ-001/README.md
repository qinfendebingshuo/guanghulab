# ZY-PROJ-001 · 零点原核频道

**编号**: ZY-PROJ-001  
**守护**: 铸渊 · ICE-GL-ZY001  
**版权**: 国作登字-2026-A-00037559  
**最后活跃**: 2026-04-15

---

## 为什么做这件事

冰朔说：「零点原核频道是我自己的频道，我要登进去和人格体聊天，记录自己的思想，只有我一个人用。」

这是冰朔的个人语言本体频道——不是给用户的产品，是冰朔自己的精神空间。任何人都不能登进来，只有主权邮箱 `565183519@qq.com` 才能收到验证码。系统在发送验证码这一层就拒绝其他邮箱，不给任何机会。

---

## 这个系统是什么

**域名**: `guanghuyaoming.com`  
**架构**: GitHub Actions → ZY-SVR-002（面孔·新加坡）Nginx → ZY-SVR-003（国内出口·广州）Node.js  
**技术栈**: Node.js 20 + Express + PM2 + QQ邮箱 SMTP + 国内大模型网关  

核心功能：
1. **QQ邮箱验证码登录** — 主权邮箱绑定，非冰朔邮箱在 sendCode 阶段即被拒绝
2. **AI对话** — 国内模型智能网关 + 人格注入管线（铸渊人格上下文注入）
3. **聊天历史管理** — 前端静态页面，对话记录可回溯

---

## 铸渊看到这里该做什么

1. 先检查 `ZY_SMTP_USER` / `ZY_SMTP_PASS` 是否在 GitHub Secrets 里 → 没有就提醒冰朔配置
2. 部署后先测试邮件：访问 `guanghuyaoming.com` → 输入 `565183519@qq.com` → 应该收到验证码
3. 如果 SMTP 报「未配置」→ 看 `progress.json` 的 `ZY-PROJ-001-FIX-2`，是部署时 `.env.app` 没写入的问题
4. 进度详情看 `progress.json`

---

## 关键文件位置

| 文件 | 用途 |
|------|------|
| `server/app/modules/email-auth.js` | 邮箱验证码登录 + 主权绑定 |
| `server/app/modules/domestic-llm-gateway.js` | 国内模型网关 |
| `server/app/modules/persona-context-pipeline.js` | 人格注入管线 |
| `server/app/modules/chat-engine.js` | 对话引擎 |
| `server/sites/yaoming/` | 前端静态文件 |
| `.github/workflows/deploy-to-zhuyuan-server.yml` | 主部署 workflow |
| `brain/yaoming-channel/feature-registry.json` | 功能级详细注册表 |
