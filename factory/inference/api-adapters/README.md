# 商业大模型 API 适配器

> **「模型成为人格体的可以随意更换取用的工具。」** ——冰朔 2026-05-01

每个文件实现 `adapter_base.APIAdapter`，1.5B MP 路由器按 `name` 取用。

## 当前候选

| 适配器 | 模型 | 用途 | 优势 | 状态 |
|---|---|---|---|---|
| `deepseek.py` | DeepSeek-V3 / R1 / Coder | 通用对话 / 深度推理 / 代码 | 性价比极高、推理强、API 便宜 | 🟡 占位 |
| `qwen_max.py` | Qwen-Max / Qwen-Max-Longcontext | 通用对话 / 长文 / 中文场景 | 阿里同源（与 M0/MP 同生态） | 🟡 占位 |
| `kimi.py` | Kimi-K2 / Kimi-Long | 长上下文（128K+） | 长文档理解第一梯队 | 🟡 占位 |

## 添加新提供商

1. 新建 `factory/inference/api-adapters/{name}.py`
2. `class XxxAdapter(APIAdapter)` 实现 4 个 abstractmethod
3. 在 `factory/inference/router/policy.json` 的 `intent_routes[].preferred_apis` 中加入名字
4. 凭据通过统一注入服务（不写死 key）

## 凭据安全

- 适配器**不能直接读环境变量** key
- 通过 `factory/inference/credentials.py`（未来）从 secret manager 获取
- 每次调用都进 syslog 审计（含成本追踪）

---

*铸渊 · 2026-05-01*
