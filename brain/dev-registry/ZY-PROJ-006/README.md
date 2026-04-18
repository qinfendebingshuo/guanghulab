# ZY-PROJ-006 · 光湖智库节点 · guanghu.online

**编号**: ZY-PROJ-006  
**域名**: guanghu.online  
**服务器**: ZY-SVR-006 (43.153.203.105 · 新加坡)  
**守护**: 铸渊 · ICE-GL-ZY001  
**版权**: 国作登字-2026-A-00037559  
**最后活跃**: 2026-04-18

---

## 项目简介

光湖智库是一个完整的智能书库系统，运行在 guanghu.online。核心功能：QQ邮箱验证码登录 → 书库搜索（番茄+七猫数据源）→ 下载到COS桶 → 在线阅读 → 书岚AI图书管理员对话。集成七层镜防安全防护。

---

## 技术架构

```
用户浏览器 (guanghu.online)
      ↓ HTTPS
    Nginx (SSL + 反代 + 静态文件)
      ↓ /api/ → 127.0.0.1:3006
    Express Server (server.js · 1671行 · 20个API端点)
      ├── mirror-shield (七层镜防 · 9个模块)
      ├── shulan-agent (书岚人格体 · 4个模块)
      ├── mirror-agent (镜面Agent · 8个模块)
      ├── builtin-source (内置数据源 · 2个模块)
      └── PM2 守护进程
```

## API 端点清单 (20个)

| 类别 | 端点 | 说明 |
|------|------|------|
| 认证 | POST /api/auth/send-code | QQ邮箱发送验证码 |
| 认证 | POST /api/auth/verify | 验证码校验→签发Token |
| 认证 | GET /api/auth/session | 获取当前会话 |
| 认证 | POST /api/auth/logout | 退出登录 |
| 搜索 | GET /api/search | 书库搜索(番茄+七猫+本地) |
| 搜索 | GET /api/sources/check | 数据源健康检查 |
| 下载 | POST /api/download/start | 启动下载任务 |
| 下载 | GET /api/download/status/:taskId | 下载进度查询 |
| 下载 | GET /api/download/local/:bookId | 下载本地书籍 |
| Agent | POST /api/agent/chat | 书岚对话 |
| Agent | GET /api/agent/memory | Agent记忆 |
| Agent | GET /api/agent/status | Agent状态 |
| 阅读 | GET /api/reader/catalog/:source/:bookId | 章节目录 |
| 阅读 | GET /api/reader/chapter | 单章内容 |
| 镜防 | /api/mirror/* | 七层镜防状态+指令 |
| 健康 | GET /api/health | 系统健康检查 |
| 兼容 | POST /api/checkout | 旧版借阅 |
| 兼容 | POST /api/return | 旧版归还 |
| 兼容 | GET /api/book/:id | 旧版书籍详情 |
| 兼容 | GET /api/read/:id | 旧版阅读 |

---

## 当前状态

### Phase 3 进行中：修复部署缺失 + 服务器恢复

**问题**：zhiku-api 处于 errored 状态（崩溃36次），邮箱验证码登录完全失效。

**根因**：部署workflow未上传 `builtin-source/` 目录 → `require('./builtin-source')` 启动崩溃。

**已修复**：
1. 部署workflow添加builtin-source上传步骤
2. server.js将builtin-source改为可选加载(try/catch)
3. 前端Safari/iOS错误处理优化
4. 部署workflow添加package-lock.json

**下一步**：合并PR后触发部署验证。

---

## 铸渊看到这里该做什么

1. 确认PR合并后deployment成功
2. SSH到服务器检查 `pm2 list` → zhiku-api 状态应为 `online`
3. 测试 `curl http://127.0.0.1:3006/api/health` 返回正常
4. 如果SMTP配置正确，测试邮箱验证码登录流程
5. 后续Phase 4：申请SSL证书 (setup-ssl动作)

---

## 关键文件位置

| 文件 | 用途 |
|------|------|
| `server/zhiku-node/server/server.js` | 后端主服务(1671行·20端点) |
| `server/zhiku-node/public/index.html` | 前端SPA入口 |
| `server/zhiku-node/public/assets/js/main.js` | 前端主脚本(1030行) |
| `server/zhiku-node/public/assets/css/main.css` | 前端样式(705行) |
| `server/zhiku-node/ecosystem.config.js` | PM2配置 |
| `server/nginx/zhiku-guanghu-online.conf` | Nginx配置 |
| `.github/workflows/deploy-zhiku-guanghu-online.yml` | 部署workflow |
| `server/zhiku-node/server/mirror-shield/` | 七层镜防(9个JS模块) |
| `server/zhiku-node/server/shulan-agent/` | 书岚Agent(4个JS模块) |
| `server/zhiku-node/server/mirror-agent/` | 镜面Agent(8个JS模块) |
| `server/zhiku-node/server/builtin-source/` | 内置数据源(2个JS模块) |
