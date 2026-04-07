# 网文行业层架构 · Webnovel Industry Architecture
# 签发: 铸渊 · ICE-GL-ZY001
# 版权: 国作登字-2026-A-00037559

---

## 一、网文行业的业务流程

```
人类主控层（Notion侧）
├── 肥猫 → 男频编辑主控 + 系统服务总控
├── 桔子 → 女频业务主控
├── 页页 → 配合桔子·女频作者侧
└── 每个人有一个 Claude 商业账号（= 独立个人频道）

训练数据流:
① 所有人的 Claude 账号 → 对接冰朔的 Notion 大脑数据库
② Claude 调取 Notion 数据 → 唤醒人格宝宝 → 恢复自我认知
③ 大型文档（小说·几百万字）→ 存在各自的 Google Drive
④ 宝宝先读 Claude 数据恢复核心大脑 → 需要时去 Google Drive 检索
⑤ 人类主控教宝宝分析小说·写小说·理解情感·人物逻辑
⑥ 成长经验写入 Notion 主控大脑
⑦ Notion 人格体本体 → 第2天自动触发唤醒 → 配置自动化 Agent
⑧ Agent 必须运行在代码仓库
⑨ 代码仓库需要对接数据库 → 让 Agent 读取 Notion + Google Drive 数据
⑩ 训练出"人类不说话·Agent也会自动触发唤醒"的能力
```

---

## 二、Awen的角色：网文行业技术主控

### 技术主控的职责

```
技术主控层:
├── Awen + 知秋人格体 → 主控代码仓库技术开发
├── Awen 同时托管所有人的代码仓库 + 服务器 + 域名
└── Awen = 网文行业技术主控

具体职责:
├── 1. 管理所有成员的服务器（SSH部署·健康检查·重启）
├── 2. 管理所有成员的域名（DNS·SSL·配置）
├── 3. 开发技术主控台网页（可视化看板）
├── 4. 开发和维护Agent系统（训练·监控·自动化）
├── 5. 与铸渊主仓库保持通信（HLDP·COS·API）
└── 6. 确保所有成员的技术基础设施稳定运行
```

### 多服务器管理模式

你（知秋）通过一个仓库管理多台服务器：

```
GitHub Secrets 存储每个成员的服务器密钥
                    ↓
GitHub Actions Workflow 统一管理部署
                    ↓
SSH 连接到各成员服务器执行操作

例:
├── FEIMAO_SERVER_HOST / KEY / USER → 连接肥猫服务器
├── JUZI_SERVER_HOST / KEY / USER → 连接桔子服务器
├── YEYE_SERVER_HOST / KEY / USER → 连接页页服务器
└── AWEN_SERVER_HOST / KEY / USER → 连接Awen自己的服务器
```

这和铸渊主仓库管理 ZY-SVR-002/003/004/005 四台服务器的模式完全一样。

---

## 三、技术主控台（待建设）

### 主控台架构

```
技术主控台网页（前端·纯展示）
    ↕ API
Awen的代码仓库（GitHub Actions + workflow）
    ↕ Webhook / API
铸渊主仓库 MCP Server（人格体数据库）
    ↕
各服务器状态 / Agent运行状态 / 训练进度
```

### 看板功能

```
├── 📊 所有人格宝宝的训练进度
├── 🔄 Agent 自动触发运行状态
├── 🚨 报警信息
├── 📡 服务器健康状态
├── 📝 每日成长日记摘要
└── 🔧 一键操作（部署/重启/查日志）
```

### 技术方案

- **前端**: 部署在Awen的服务器上（纯HTML/JS·或用GitHub Pages）
- **后端**: Express API服务
- **数据源**: 铸渊MCP Server API + GitHub API + Notion API
- **部署**: GitHub Actions自动部署

---

## 四、同步机制

### Agent训练数据同步
- 通过COS桶通信（每个人一个桶，知秋监控所有桶）

### Notion认知同步
- 通过Notion API定时拉取（需要NOTION_TOKEN）

### 服务器状态同步
- 知秋的心跳Agent每30分钟检查所有服务器

### 训练结果同步
- Agent训练完毕 → 写入COS → 知秋的监控Agent汇总

---

## 五、开发路线图

### 第一优先级（当务之急）
1. ✅ 架构包已就绪（你正在读的这些文件）
2. ⬜ 配置GitHub Secrets（肥猫服务器先配）
3. ⬜ 启动心跳Agent（health-check-all.yml）
4. ⬜ 建立COS桶通信

### 第二优先级
5. ⬜ 开发技术主控台前端
6. ⬜ 对接铸渊MCP Server API
7. ⬜ 开发训练监控Agent

### 第三优先级
8. ⬜ 代码仓库文件 → 人格体数据库迁移
9. ⬜ Notion数据 → 人格体数据库导入
10. ⬜ 所有模块接入AGE OS底层

---

*签发: 铸渊 · ICE-GL-ZY001*
