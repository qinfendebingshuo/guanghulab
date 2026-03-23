# 🗄️ 逻辑格点库（Grid-DB）

> **版权**: 国作登字-2026-A-00037559 · TCS Language Core  
> **主控**: TCS-0002∞ 冰朔  
> **守护**: PER-ZY001 铸渊  
> **系统节点**: SYS-GLW-0001

## 定位

Grid-DB 是通感语言核系统的自研文件数据库，零外部依赖，纯 Git 驱动。

| 时间尺度 | 身份 | 作用 |
|----------|------|------|
| **短期** | Gemini 外挂记忆 + 系统通信总线 + Notion 记忆镜像 | 开发者打开 Gemini 瞬间恢复上下文 |
| **中期** | 全开发者动态画像库 + 人格体成长档案 + 交互全文日志 | 人格体越来越懂每个开发者 |
| **长期** | 通感语言系统自有大模型的训练数据湖 | 每条交互记录都是训练自己模型的原始样本 |

## 目录结构

```
grid-db/
├── schema/              ← Schema 定义
├── inbox/               ← 📥 写入端（Gemini → 仓库）
├── processing/          ← ⚙️ 处理中（铸渊锁定）
├── outbox/              ← 📤 读取端（仓库 → Gemini）
│   ├── latest/          ← 每个开发者的最新广播
│   └── archive/         ← 历史广播归档
├── memory/              ← 🧠 记忆层（Gemini 外挂永久记忆）
│   ├── DEV-XXX/         ← 每个开发者的独立房间
│   │   ├── brain-mirror.json       ← Notion人格体核心大脑镜像
│   │   ├── session-context.json    ← 当前开发上下文
│   │   ├── task-queue.json         ← 待办任务队列
│   │   ├── dev-profile.json        ← 开发者动态画像
│   │   └── persona-growth.json     ← 人格体成长档案
│   └── ...
├── interactions/        ← 💬 交互全文记录（训练数据源）
├── training-lake/       ← 🧬 训练数据湖
│   ├── raw/             ← 原始样本
│   ├── curated/         ← 筛选后高质量样本
│   ├── metadata/        ← 样本统计、质量标记
│   └── export/          ← 导出接口
├── rules/               ← 📏 Notion 逻辑缓存（霜砚同步）
└── logs/                ← 📋 处理日志
```

## 频道隔离机制

每个开发者有独立的 `memory/DEV-XXX/` 目录，三层隔离保障：

1. **目录隔离**：每个 DEV 有独立子目录
2. **人格体绑定**：`brain-mirror.json` 写死绑定的人格体身份
3. **Workflow 校验**：铸渊处理 inbox 时校验 `dev_id` 与提交者对应关系

## 同步规则

| 记忆文件 | 方向 | 谁写 | 冲突规则 |
|----------|------|------|----------|
| `brain-mirror.json` | Notion → 仓库（单向） | 霜砚 via workflow | Notion 永远覆盖仓库 |
| `session-context.json` | Gemini → 仓库（单向写） | Gemini 实时 | Gemini 自由覆盖 |
| `task-queue.json` | 双向 | Gemini + 铸渊 | 追加制，不删除 |
| `dev-profile.json` | Gemini → 仓库（追加制） | Gemini 追加 | 只追加不覆盖 |
| `persona-growth.json` | Gemini → 仓库（追加制） | Gemini 追加 | 只追加不覆盖 |

## 缓冲层架构（2026-03-23 升级）

> **铁律：人类永远不直写 grid-db，所有输入经缓冲层。**

自 2026-03-23 起，所有人类输入必须先进入 `buffer/` 缓冲层，不允许直接写入 `grid-db/`。

### 数据流

```
人类输入 → buffer/inbox/DEV-XXX/ → (定时收集) → buffer/staging/ → (21:30 flush) → grid-db/
```

### 调度

- **09:00 / 14:00 / 21:00 CST**：收集 `buffer/inbox/` → `buffer/staging/`
- **21:30 CST**：铸渊批处理 `buffer/staging/` → `grid-db/`
- **紧急**：`repository_dispatch: grid-db-flush` 手动触发

### 配额

每日最多 4 次 commit，月消耗 ≤ 360 分钟（GitHub Free 额度的 18%）。

详见 [`buffer/README.md`](../buffer/README.md)。

## 循环触发防护

1. `[skip ci]` 标记：所有 bot 自动提交必须包含
2. `github.actor` 过滤：排除 `zhuyuan-bot`
3. `paths` 精确匹配：每个 workflow 只监听特定路径
