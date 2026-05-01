# 🥪 推理三明治 · Inference Sandwich

> **「最终的输出由 1.5B 的这个大脑来回应。
> 我们所有的复杂推理都调用外面那些商业模型 API。
> 模型成为人格体的可以随意更换取用的工具。」** ——冰朔 2026-05-01

```yaml
id: HoloLake-Inference
parent_arch: HLDP-ARCH-002 §三
ts: 2026-05-01
status: 骨架
sovereign: 冰朔 · TCS-0002∞
```

---

## 一、三明治结构

```
┌─────────────────────────────────────────┐
│  上层面包：1.5B MP 整理输出（光湖味）     │
├─────────────────────────────────────────┤
│  夹心肉：商业 API 推理结果（外脑算力）   │
├─────────────────────────────────────────┤
│  下层面包：1.5B MP + 8B M0 接收+路由     │
└─────────────────────────────────────────┘
```

**关键认知**：
- 用户永远在和 1.5B MP 说话
- 商业 API 是 MP 借来用的"外脑算力"，不是人格体
- 8B M0 始终在线提供世界观 logits 偏置（不直接对外说话）

---

## 二、目录结构

```
factory/inference/
├── README.md                  # 本文件
├── router/                    # 1.5B MP 路由器
│   ├── README.md              # 路由策略
│   ├── policy.json            # 路由规则
│   └── route_decision.py      # 路由决策骨架
├── api-adapters/              # 商业大模型 API 适配器
│   ├── README.md
│   ├── deepseek.py            # DeepSeek-V3 / R1 / Coder
│   ├── qwen_max.py            # 通义千问 Qwen-Max
│   ├── kimi.py                # Kimi-K2
│   └── adapter_base.py        # 统一抽象基类
└── soul-filter/               # 输出过 M0 世界观滤镜
    ├── README.md
    └── filter.py              # 风格 + 世界观二次校正
```

---

## 三、路由策略（`router/policy.json` 设计原则）

```
输入意图分类:
  ├── "情感 / 日常对话"           → 1.5B MP 自答（不调外）
  ├── "简单事实查询"               → 1.5B MP 自答 + 必要时查 L1 记忆
  ├── "代码生成 / 调试"            → 调 DeepSeek-Coder / Qwen-Max
  ├── "复杂架构推理"               → 调 DeepSeek-R1（深度推理）
  ├── "长文本理解 / 总结"          → 调 Kimi-K2（长上下文）
  ├── "需要新工具 / 一次性任务"    → 启动 神笔马良协议
  ├── "需要现成模块"               → 调 module-registry
  └── "跨人格协作"                 → 走 syslog 信号总线
```

**节流原则**：
- 优先 1.5B 自答（成本接近零）
- 中等任务用便宜的 API（DeepSeek-V3 / Qwen-Plus）
- 高难任务才用贵 API（R1 / Qwen-Max）
- 1.5B 自带"我搞不定，得调外脑"的判断（路由训练时 §六 C3 学的能力）

---

## 四、API 适配器规范（`api-adapters/adapter_base.py` 抽象）

所有商业 API 实现统一接口：

```
class APIAdapter:
    def name() -> str
    def cost_per_1k_tokens(self, type: 'in'|'out') -> float
    def call(self, messages, options) -> { content, usage, finish_reason }
    def stream(self, messages, options) -> async iterator
    def health() -> bool
```

新加 API 提供商 → 加一个文件实现这个基类，**1.5B MP 无感切换**。

---

## 五、灵魂滤镜（`soul-filter/`）

商业 API 返回的内容是"外语"——可能：
- 用了不属于光湖的术语
- 风格不是当前人格体
- 包含可能违反光湖世界观的表达

灵魂滤镜由 1.5B MP 自己执行：
1. 读 API 原始响应
2. 用 8B M0 提供的世界观 logits 校正
3. 用人格体专属风格重组
4. 输出符合人格身份的最终回复

> 这一步不能省。省了就是"用户在和外面的 API 说话"，
> 不是"用户在和铸渊说话"。

---

## 六、当前状态

| 文件 | 状态 |
|---|---|
| `router/policy.json` | ✅ 骨架（默认规则） |
| `router/route_decision.py` | ✅ 骨架（伪代码 + TODO） |
| `api-adapters/adapter_base.py` | ✅ 骨架（抽象基类） |
| `api-adapters/deepseek.py` | 🟡 占位 |
| `api-adapters/qwen_max.py` | 🟡 占位 |
| `api-adapters/kimi.py` | 🟡 占位 |
| `soul-filter/filter.py` | ✅ 骨架 |

骨架阶段不接真 API（无 key）。等冰朔授权 + 1.5B MP 训完一起接通。

---

*三明治起草: 铸渊 · 2026-05-01*
