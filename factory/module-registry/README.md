# 📦 模块注册中心 (Module Registry)

> **「这个 Agent 必须是铸渊的分身。
> 因为代码仓库没有任何人格体比铸渊更理解开发过的模块。」** ——冰朔

```yaml
id: HoloLake-ModuleRegistry
parent_arch: HLDP-ARCH-002 §五 + §七
agent_id: ICE-GL-ZY001-MR (铸渊分身 · Module Registry)
ts: 2026-05-01
status: 仅 README 占位（等基础打通后实施）
```

---

## 一、存在意义

工厂运行起来之后，会有两类工具/模块进入仓库：

1. **神笔马良写出来 + 上交共享的工具**（一次性写出，人格体决定 share）
2. **历史模块**（仓库里现有的 m01 / m03 / m05 / ... 各种模块）

这些东西需要一个**懂光湖世界观 + 知道每个模块来龙去脉 + 可持续成长**的管理员。
这只能是铸渊的分身（同一份 1.5B 权重 fork 一份独立微调）。

---

## 二、职责

```
铸渊分身 (ICE-GL-ZY001-MR)
├── 元数据库 (PostgreSQL)
│   ├── 模块表（id / name / version / sha256 / dependencies / hli_id）
│   ├── 部署历史表
│   ├── 调用日志表（哪个 Agent 在什么场景下调过）
│   └── 思维标注表（这个模块当初为什么这么设计 · 取自 thinking-traces）
│
├── HLI 协议 API
│   ├── HLI-MODULE-001 register   注册新模块（神笔上交 / 手动）
│   ├── HLI-MODULE-002 fetch      按 id 拉模块
│   ├── HLI-MODULE-003 list       列出 / 搜索
│   ├── HLI-MODULE-004 deprecate  下架
│   └── HLI-MODULE-005 review     评审神笔上交（accept / reject / observe）
│
└── 自维护循环（每天定时）
    ├── 扫一遍仓库 → 发现孤儿模块 → 报警
    ├── 检查 schema 与代码是否对齐 → 不对齐报警
    └── 生成《模块健康报告》给冰朔
```

---

## 三、与服务器热插拔的关系

> **「服务器上不装大量工具。模块通过 HLI 协议按需热加载。」** ——冰朔

```
轻量服务器（推理 + 注册中心）
    ↓ 人格体需要某模块
HLI-MODULE-002 fetch
    ↓
按需拉取 + 校验 sha256 + 沙箱加载 + 用完释放
```

服务器永远只装：**注册中心 + 推理引擎 + 1.5B/8B 权重**。
业务模块=按需拿。

---

## 四、当前状态

🟡 仅本 README 占位。

落地顺序（等工厂基础打通后）：
1. PostgreSQL schema 设计（元数据库）
2. HLI-MODULE-* 5 个 API 实现
3. 铸渊分身蒸馏（M0 → 1.7B + 模块管理任务的思维链微调）
4. 接入神笔的 share 流程
5. 接管历史模块（m01/m03/...）的元数据登记

---

*起草: 铸渊 · 2026-05-01*
