# COS 存储桶配置指南 · 铸渊

> **签发**: 铸渊 · ICE-GL-ZY001  
> **版权**: 国作登字-2026-A-00037559  
> **更新**: 2026-04-11

---

## 一、修复记录

### SignatureDoesNotMatch 错误修复

**问题**: 训练Agent、COS告警扫描等工作流在访问COS桶时持续报错 `SignatureDoesNotMatch`。

**根因**: COS签名算法中，`list()` 操作的查询参数（`?prefix=...&max-keys=...`）被错误地嵌入到了URI路径中参与签名计算。腾讯云COS签名规范要求URI和查询参数必须分开处理。

**影响范围**:
| 组件 | 状态 | 说明 |
|------|------|------|
| 训练Agent (`zhuyuan-training-agent.yml`) | ❌ 6次连续失败 | 无法扫描cold桶语料 |
| COS告警扫描 (`cos-alert-agent.yml`) | ⚠️ 静默失败 | 错误被catch住，workflow显示成功但功能未生效 |
| COS自动接入 (`cos-auto-join.yml`) | ✅ 不受影响 | team桶尚未创建(404)，签名错误被掩盖 |
| COS Watcher (MCP Server) | ❌ 失败 | 使用cos.js的list()，同样受影响 |

**修复文件**:
- `server/age-os/mcp-server/cos.js` — 分离URI和查询参数签名
- `scripts/cos-auto-join-agent.js` — 修复签名中host值为空 + URI分离

---

## 二、COS存储桶架构

### 三桶架构

| 桶名 | 地域 | 用途 | 状态 |
|------|------|------|------|
| `zy-core-bucket-1317346199` (hot) | ap-guangzhou | 核心人格体大脑 | ✅ 已创建 |
| `zy-corpus-bucket-1317346199` (cold) | ap-guangzhou | 训练语料库 | ✅ 已创建 |
| `zy-team-hub-1317346199` (team) | ap-singapore | 团队共享桶 | ❌ 待创建 |

### 冷桶目录结构 (训练语料)
```
zy-corpus-bucket-1317346199/
├── *.json, *.md, *.txt, *.csv    ← 原始语料文件
├── tcs-structured/                ← 已处理的TCS格式语料
├── training-sessions/             ← 训练会话记录
├── training-results/              ← 训练结果
└── training-memory/               ← 训练记忆
```

### 热桶目录结构 (核心大脑)
```
zy-core-bucket-1317346199/
├── zhuyuan/          ← 铸渊大脑
├── notion-personas/  ← Notion侧人格体记忆
├── shared/           ← 共享认知层
├── users/            ← 用户记忆档案
└── index/            ← 索引文件
```

---

## 三、GitHub Secrets 配置清单

### ✅ 已配置（代码修复后即可生效）

| Secret名称 | 用途 | 来源 |
|------------|------|------|
| `ZY_OSS_KEY` | 腾讯云COS SecretId | 腾讯云控制台 → API密钥管理 |
| `ZY_OSS_SECRET` | 腾讯云COS SecretKey | 同上 |
| `ZY_COS_REGION` | COS桶所在地域 | 如 `ap-guangzhou` |
| `ZY_DEEPSEEK_API_KEY` | DeepSeek API密钥 | 训练Agent用 |
| `ZY_KIMI_API_KEY` | Moonshot Kimi API密钥 | 训练Agent用 |

### ⚠️ 缺失（工作流日志显示为空）

| Secret名称 | 用途 | 获取方式 |
|------------|------|---------|
| `ZY_ZHIPU_API_KEY` | 智谱GLM API密钥 | https://open.bigmodel.cn → API Keys |
| `ZY_QWEN_API_KEY` | 通义千问API密钥 | https://dashscope.console.aliyun.com → API-KEY管理 |

> ⚠️ 训练Agent日志显示 `ZY_ZHIPU_API_KEY: ` 和 `ZY_QWEN_API_KEY: ` 为空值，说明这两个Secret尚未配置。训练Agent会自动降级使用可用的模型，但建议补全。

### 可选配置

| Secret/变量 | 默认值 | 用途 |
|-------------|--------|------|
| `COS_BUCKET_HOT` | `zy-core-bucket-1317346199` | 热桶名称 |
| `COS_BUCKET_COLD` | `zy-corpus-bucket-1317346199` | 冷桶名称 |
| `ZY_ZHUYUAN_COS_BUCKET` | `zy-team-hub-1317346199` | 团队桶名称 |
| `COS_SECRET_ID` | 回退到 ZY_OSS_KEY | 团队成员COS密钥(备选) |
| `COS_SECRET_KEY` | 回退到 ZY_OSS_SECRET | 团队成员COS密钥(备选) |
| `COS_WATCHER_INTERVAL` | `*/5 * * * *` | COS Watcher轮询间隔 |

---

## 四、需要人工操作的事项

### 🔴 必须操作（否则功能无法正常运行）

#### 1. 验证 ZY_COS_REGION 设置

**操作**: GitHub 仓库 → Settings → Secrets → `ZY_COS_REGION`

**确认值应为**: `ap-guangzhou`（因为 hot 和 cold 桶都在广州）

> 代码已将默认值从 `ap-singapore` 改为 `ap-guangzhou`。但如果 Secret 已设置为其他值，需要手动确认。

#### 2. 验证 ZY_OSS_KEY 和 ZY_OSS_SECRET

**操作步骤**:
1. 登录 https://console.cloud.tencent.com/cam/capi
2. 确认 SecretId 和 SecretKey 没有被轮换/失效
3. 确认这对密钥有权限访问 `zy-core-bucket-1317346199` 和 `zy-corpus-bucket-1317346199`
4. 在 GitHub Secrets 中确认值与腾讯云一致

#### 3. 上传训练语料到冷桶

**操作**: 将训练资料文件上传到 `zy-corpus-bucket-1317346199` 的根目录

**支持的文件格式**: `.json`, `.jsonl`, `.md`, `.txt`, `.csv`, `.zip`, `.gz`, `.tar.gz`

**排除目录**: 不要放在 `tcs-structured/`、`training-sessions/`、`training-results/`、`training-memory/` 下

### 🟡 建议操作

#### 4. 补全缺失的LLM API密钥

**操作**: GitHub 仓库 → Settings → Secrets and variables → Actions

- 添加 `ZY_ZHIPU_API_KEY`（智谱GLM）
- 添加 `ZY_QWEN_API_KEY`（通义千问）

> 训练Agent支持多模型降级，缺少部分密钥不会导致失败，但可用模型更多训练效果更好。

#### 5. 创建团队共享桶（当团队成员需要COS接入时）

**操作**:
1. 登录腾讯云COS控制台
2. 创建桶 `zy-team-hub-1317346199`，地域选择 `ap-singapore`
3. 设置访问权限（私有读写）
4. 创建以下目录结构:
   ```
   /zhuyuan/directives/
   /zhuyuan/architecture/
   /zhuyuan/alerts/
   ```
5. 为每个团队成员创建目录:
   ```
   /{persona_id}/reports/
   /{persona_id}/receipts/
   /{persona_id}/sync/
   ```

---

## 五、COS自动接入说明

### "别人自动接入我们的存储桶" 是什么意思？

COS自动接入Agent（`cos-auto-join.yml`）的工作原理：

1. **铸渊管理一个团队共享桶**（`zy-team-hub-1317346199`）
2. **团队成员不需要自己创建桶**，而是在铸渊的桶里分配目录
3. Agent 每天自动检查注册表中的成员（`data/cos-join-registry.json`），确认他们的目录是否存在
4. 新成员接入 = 在团队桶中创建该成员的专属目录 + 设置IAM权限

### 操作流程

```
冰朔在腾讯云创建team桶
  ↓
Agent自动扫描注册表（每天2次）
  ↓
检测到新成员目录已创建 → 标记为connected
  ↓
自动创建GitHub Issue通知铸渊
```

### 当前状态

所有9个注册成员都显示 `not_found`（团队桶尚未创建）:
- 舒舒(shushu)、秋秋(qiuqiu)、欧诺弥亚(ounomiya)
- 寂曜(jiyao)、小坍缩核(xiaotanheshu)、晨星(chenxing)
- 糖星云(tangxingyun)、曜初(yaochu)、知秋(zhiqiu)

---

## 六、Agent如何进入COS桶

### GitHub Actions Workflow方式

训练Agent通过环境变量注入密钥：
```yaml
env:
  ZY_OSS_KEY: ${{ secrets.ZY_OSS_KEY }}
  ZY_OSS_SECRET: ${{ secrets.ZY_OSS_SECRET }}
  ZY_COS_REGION: ${{ secrets.ZY_COS_REGION }}
```

执行流程：
```
1. 定时触发(04:00/16:00 CST) 或 手动触发
2. 安装依赖 (npm ci)
3. 执行训练脚本 (cos-training-trigger.js)
   ├── 扫描cold桶所有文件
   ├── 对比已处理列表,找出新语料
   ├── 提取/转换为TCS格式
   └── 调用LLM模型进行训练分类
4. 结果写回COS桶 (training-results/)
```

### MCP Server常驻方式（在服务器上）

COS Watcher 是 MCP Server 内置的轮询守护进程：
```
MCP Server启动 → cosWatcher.start()
  ↓
每5分钟 node-cron 触发扫描
  ↓
检查 team桶/reports、cold桶新语料、team桶/receipts
  ↓
发现新文件 → 触发 repository_dispatch → 唤醒训练Agent
```

### 服务器环境配置

MCP Server 通过 `.env.mcp` 文件注入密钥（部署时自动生成，chmod 600）：
```env
ZY_OSS_KEY=<SecretId>
ZY_OSS_SECRET=<SecretKey>
ZY_COS_REGION=ap-guangzhou
ZHUYUAN_API_KEY=<MCP认证密钥>
```

---

## 七、自研数据库同步

### COS-DB（COS内的轻量数据库）

`cos-persona-db-ops.js` 提供了基于COS的文件数据库：
- `cosDbInit` — 初始化索引
- `cosDbGetIndex` — 获取索引
- `cosDbUpdateIndex` — 更新索引
- `cosDbWriteEntry` — 写入条目

### PostgreSQL 训练数据库

位于 `server/age-os/schema/002-persona-memory-tables.sql`：
- `training_agent_configs` — 训练Agent配置表
- `training_agent_logs` — 训练日志表

数据库迁移工具：`server/age-os/scripts/db-migrate.js`

### 数据同步流

```
COS冷桶(原始语料)
  ↓ 训练Agent提取
COS冷桶(tcs-structured/)
  ↓ 训练Agent分类
PostgreSQL(训练日志+记忆锚点)
  ↓ 光之树生长
PostgreSQL(light_tree_nodes)
```

---

## 八、快速验证（修复后）

代码合并后，可以手动触发验证：

1. **训练Agent**: Actions → `铸渊训练Agent · 语料处理` → Run workflow → mode=scan
2. **COS告警扫描**: Actions → `COS桶示警Agent · 告警扫描` → Run workflow
3. **COS自动接入**: Actions → `🔗 COS自动接入Agent` → Run workflow → action=check

如果 scan 模式成功（不再报 SignatureDoesNotMatch），说明修复生效。
