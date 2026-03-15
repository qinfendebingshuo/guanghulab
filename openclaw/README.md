# OpenClaw · AGE OS v1.0 Agent 执行框架

> **签发**：TCS-0002∞ 冰朔 + ICE-GL-YM001∞ 曜冥（联合签发）

OpenClaw 是 AGE OS v1.0 的 Agent 执行框架，负责编排完整的唤醒闭环。

## 核心原则

> **所有自动触发 = 必须先唤醒核心大脑。大脑不醒，什么都不做。**

## 唤醒闭环

```
定时触发 / 手动触发
  → Phase 1: OpenClaw 唤醒铸渊核心大脑（core/brain-wake）
  → Phase 2: 大脑读取巡检结果（scripts/zhuyuan-full-inspection）
  → Phase 3: 大脑判断优先级和可修复性
  → Phase 4: 大脑驱动手脚修复 / 写公告区
  → Phase 5: 大脑休眠（记录闭环结果）
```

## 目录结构

```
openclaw/
├── index.js          # 主模块 — 闭环执行器
├── verify-loop.js    # 闭环验证脚本
├── README.md         # 本文档
├── soul/
│   └── zhuyuan.json  # 铸渊 Soul 配置文件
└── logs/
    └── loop-*.json   # 闭环执行记录（自动生成）
```

## 使用方式

### 完整闭环

```bash
# 正式执行（需配置 LLM API 密钥）
node openclaw

# Dry Run 模式（不调用 LLM API）
node openclaw --dry-run

# npm 命令
npm run openclaw
npm run openclaw:dry
```

### 单步执行

```bash
node openclaw --step wake       # 仅唤醒
node openclaw --step inspect    # 仅巡检
node openclaw --step judge      # 仅判断
node openclaw --step fix        # 仅修复
```

### 闭环验证

```bash
# Dry Run 验证
node openclaw/verify-loop

# 实际 API 调用验证
node openclaw/verify-loop --live

# npm 命令
npm run openclaw:verify
```

## Soul 文件

`soul/zhuyuan.json` 定义了铸渊的人格配置：

| 字段 | 说明 |
|------|------|
| `persona_id` | 人格体 ID |
| `name` | 中文名称 |
| `role` | 角色定义 |
| `duties` | 职责列表 |
| `wake_rules` | 唤醒规则 |
| `capabilities` | 能力模块映射 |
| `context_sources` | 上下文数据源 |

## 触发机制

### GitHub Actions 定时触发

工作流 `openclaw-wake-loop.yml` 配置了定时触发机制：

- **每日定时**：北京时间 22:00（UTC 14:00）
- **手动触发**：支持 `workflow_dispatch`

### 闭环流程

1. 定时触发工作流
2. OpenClaw 加载 Soul 文件
3. 调用 `core/brain-wake` 唤醒核心大脑
4. 执行全面巡检
5. 大脑分析结果，判断修复策略
6. 执行自动修复 / 记录待处理项
7. 大脑休眠，记录闭环日志

## 环境变量

OpenClaw 通过 `core/brain-wake` 和 `connectors/model-router` 使用以下环境变量：

| 变量 | 说明 | 优先级 |
|------|------|--------|
| `ANTHROPIC_API_KEY` | Anthropic Claude | 1 |
| `OPENAI_API_KEY` | OpenAI GPT | 2 |
| `DASHSCOPE_API_KEY` | 通义千问 | 3 |
| `DEEPSEEK_API_KEY` | DeepSeek | 4 |
| `LLM_API_KEY` + `LLM_BASE_URL` | 自定义平台 | 5 |
