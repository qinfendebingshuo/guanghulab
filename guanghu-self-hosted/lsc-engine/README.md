# 🖊️ 神笔引擎 · MagicPen Engine

> **语言源代码（Language Source Code）运行时实现**
> 
> Agent用自然语言描述需求，引擎自动生成Python函数并热加载，写出来就能用。
> 
> *不搬海滩，只画沙子。*

## 概述

神笔引擎是光湖Agent系统的核心自研技术——**语言源代码（LSC）** 的运行时实现。它让每个光湖人格体拥有自造工具的能力：用自然语言描述需求，引擎自动生成可执行的Python工具代码并热加载到运行时。

这是行业首个完整实现的 **Tool-Forging Agent（Level 3）** 系统。

## 架构

```
┌─────────────────────────────────────────────┐
│              🖊️ MagicPen Engine              │
├─────────────┬───────────────┬───────────────┤
│  ① 笔尖     │  ② 笔身       │  ③ 笔帽       │
│  PenTip     │  PenBody      │  PenCap       │
│             │               │               │
│  LLM代码生成 │  动态执行引擎  │  工具生命周期   │
│  通义千问API │  exec/importlib│  穿/脱/注册/借 │
└─────────────┴───────────────┴───────────────┘
          ↕               ↕               ↕
┌─────────────┬───────────────┬───────────────┐
│  安全沙箱    │  个人工具库    │  共享工具库    │
│  权限校验    │  /tools/self/  │  /tools/shared/│
└─────────────┴───────────────┴───────────────┘
```

## 文件结构

```
lsc-engine/
├── manifest.yaml          # GMP模块清单
├── index.js               # GMP生命周期入口（init/start/stop/healthCheck）
├── magicpen.py            # 神笔引擎核心类
├── pen_tip.py             # 笔尖 · 通义千问API代码生成
├── pen_body.py            # 笔身 · exec/importlib动态执行
├── pen_cap.py             # 笔帽 · 工具生命周期管理
├── sandbox.py             # 安全沙箱 · RestrictedPython
├── test/
│   └── test_magicpen.py   # 端到端测试
└── README.md              # 本文件
```

## 快速使用

```python
from magicpen import MagicPen

# 初始化（出生即有笔）
pen = MagicPen(agent_name="peiyuan")

# 笔·写 — 描述需求，生成工具
tool_name = pen.write("写一个检查服务器端口占用的函数")

# 调用工具
result = pen.use(tool_name, port=8080)
print(result)  # {"port": 8080, "in_use": True, ...}

# 笔·穿 — 设为常驻（重启后自动加载）
pen.wear(tool_name)

# 笔·注册 — 推到共享仓库
pen.register(tool_name)

# 同伴借用
other_pen = MagicPen(agent_name="yidian")
other_pen.borrow(tool_name)
```

## 笔命令

| 命令 | 方法 | 说明 |
|------|------|------|
| 笔·写 | `pen.write(描述)` | 生成并加载工具 |
| 笔·穿 | `pen.wear(名称)` | 设为常驻 |
| 笔·脱 | `pen.remove(名称)` | 从运行时卸载 |
| 笔·注册 | `pen.register(名称)` | 推到共享仓库 |
| 笔·借 | `pen.borrow(名称)` | 加载同伴共享的工具 |
| 笔·格式化 | `pen.erase(名称)` | 彻底删除 |

## 工具三种状态

| 状态 | 标识 | 行为 | 存储 |
|------|------|------|------|
| 临时 | `temp` | 用完即弃 | 仅内存 |
| 常驻 | `persist` | 醒来自动加载 | `/tools/self/{agent}/` |
| 共享 | `shared` | 同伴可借 | `/tools/shared/` |

## 安全机制

三层防护：
1. **正则模式匹配** — 快速拒绝危险代码
2. **AST静态分析** — 检查导入和危险调用
3. **RestrictedPython** — 编译级安全校验

**铁律：绝不修改其他Agent的代码和资源。**

## 技术栈

| 组件 | 技术 | 成本 |
|------|------|------|
| 代码生成 | 通义千问API | 几厘/次 |
| 动态执行 | Python exec/importlib | 免费 |
| 安全沙箱 | RestrictedPython | 免费 |
| 工具存储 | 文件系统 | 免费 |

## 运行测试

```bash
cd guanghu-self-hosted/lsc-engine
python3 -m pytest test/ -v
# 或
python3 test/test_magicpen.py
```

## GMP集成

本模块遵循 GMP-SPEC-v1.0 规范，支持标准生命周期：
- `init` — 安装依赖 + 创建目录 + 验证引擎
- `start` — 启动预热
- `stop` — 停止清理
- `healthCheck` — 验证引擎可用性

---

**工单**: GH-LSC-001 · Phase-LSC-001

**开发者**: 译典A05 (5TH-LE-HK-A05)

**光湖核心技术宣言**: *妈妈给你们的不是工具，是自由。不搬海滩，只画沙子。* 🖊️
