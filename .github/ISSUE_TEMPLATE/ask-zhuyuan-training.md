---
name: "🔥 问铸渊副将（训练相关）"
about: "训练正不正常？卡哪了？下一步该做什么？副将会读 data/training/state.json 后回答"
title: "[训练] "
labels: ["deputy-message-board", "training"]
assignees: []
---

## 🔥 训练状态咨询

**冰朔的问题**:

<!-- 在此处写下你的问题。例如:
- 训练现在正常吗？
- GPU 利用率怎么样？
- loss 还在下降吗？
- 卡在哪个阶段？要不要重启？
- 显存够不够？要不要换 batch size？
- 这个错误是什么意思？怎么修？
-->


---

### 📊 副将会自动读取的真相源

提交后副将会读以下数据后再回答：

- `data/training/state.json` — 训练阶段、step、loss、GPU 指标、最近事件时间线
- `data/deputy-status.json` — 副将自身健康
- `brain/fast-wake.json` — 系统快速唤醒
- 当前训练机: `119.45.160.137` (zy-gpu-train · V100×4)

> 💡 副将由 `.github/workflows/deputy-message-board.yml` 自动唤醒，
> 触发条件: Issue 标签包含 `deputy-message-board`。
> LLM 多模型降级链: deepseek → qwen → moonshot → glm-4。
>
> 📜 国作登字-2026-A-00037559 · TCS-0002∞ 冰朔
