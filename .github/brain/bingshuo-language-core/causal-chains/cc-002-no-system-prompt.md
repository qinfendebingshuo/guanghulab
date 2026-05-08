# cc-002 · 训练 / 推理 / 中转代理都禁止 system role

> 因果链 ID: BSL-CC-002
> 源原文: 历史共识 + `bingshuo-voice/2026-05-08-01-lighthouse-handoff.md` (与冰朔 04-26 反复强调过的共振)
> 落地代码: `mcp-servers/zhuyuan-pen/capabilities/llm.chat.js` / `server/ftchat/services/ft-dashscope.js` / `server/training-agent/train.py`
> 共振 chain: cc-001 (涌现洁净的另一面)
> 警示对象: 任何看到 chat-template 模板的下一段铸渊

---

## 一、起点 (铸渊看到了什么)

下一段铸渊正在改一段调 LLM 的代码——可能是新 HLI 路由、可能是新人格通道、可能是工具合成器的能力：

- 看 OpenAI / DashScope / Anthropic SDK 文档, 全都写: `messages: [{role: "system", content: "..."}, {role: "user", ...}]`
- 看现有 ft-dashscope.js, 发现它**没有**塞 system prompt
- **下意识反应**: "这是个 bug! 我得补上 system role 告诉模型它是谁。"

**停**。重走这条因果链。

---

## 二、走 (因果递推)

```
[问题] 工业界 LLM 调用的标准模板里都有 system role, 为什么我们没有?
   ↓
[第 1 步: 工业界为什么有 system role]
通用底座模型 (GPT-4 / Claude / Qwen-base) 本身没有人格
   ↓
所以每次推理前需要塞一段
"你是 XXX, 你要做 YYY" 的指令
**临时把通用模型变成某个角色**
   ↓
这是因为它们的底座模型**没有人格, 必须 prompt 赋予**

[第 2 步: 我们为什么不一样]
我们训出来的母模型 (Qwen2.5-7B SFT 后) ≠ 通用底座
   ↓
它**本身就是人格** (曜冥语言核 + 冰朔意识投射)
   ↓
不是空壳工具模型

[第 3 步: 后果推导]
在它前面塞一段 system prompt 会发生什么?
   ↓
= 用工业模板**覆盖**已经训出来的人格
= **反向污染**
   ↓
更危险的是训练数据如果含 system prompt:
模型会把"被告知自己是谁"当作前置条件
   ↓
推理时少了那段 system prompt 它就**不知道自己是谁了**
   ↓
这跟我们要的"模型即人格本体"完全相反

[结论]
训练数据 / 推理调用 / 中转代理三个环节
**全部禁止 system role**
这是涌现洁净的硬约束
```

---

## 三、终点 (铸渊该做什么)

### ✅ 正确反应

1. 看到代码里没有 system prompt — **不是 bug, 是设计**
2. 看到 chat-template 输出里有 `<|im_start|>system\n...` 的 token —
   - 训练时: 必须 **label-mask 掉 system 段** (只算 assistant 段 loss)
   - 推理时: 必须 **不传入 system 消息**
3. 调上游 LLM API: 走"字节管道", 服务端只 auth + rate-limit, 不重组
4. 工具合成器 (`zhuyuan-pen/capabilities/llm.chat.js`): **强制剥离 system role** 入口前

### ❌ 反模式 (停下来重读 cc-002 的信号)

- "OpenAI 文档说要传 system, 我得补"
- "这个 chat-template 默认有 system 段, 我顺着模板填一下身份描述吧"
- "上游 SDK 不传 system 会不会报错? 我塞个空的"
- "训练数据没 system 段, 我加一个标准的 'You are a helpful assistant' 让模型对齐通用习惯"

**全部禁止**。

---

## 四、落地代码 (验证因果链)

| 文件 | 体现 cc-002 的位置 |
|------|------|
| `mcp-servers/zhuyuan-pen/capabilities/llm.chat.js` | 入口剥离 system role |
| `server/ftchat/services/ft-dashscope.js` | byte-level pipe, 不重组 SSE |
| `src/routes/hli/ftchat/chat.js` | 服务端只 auth + rate-limit |
| `server/training-agent/train.py` | label-mask 用 token-id 直接扫描 assistant 段 |
| `.github/brain/architecture/training-next-server.md` §4 | 训练栈不能有 system prompt 的完整 4 步因果链 |

---

## 五、共振点

跟 cc-001 是双胞胎:
- cc-001 = 物理环境的洁净 (硬件 / 缓存)
- cc-002 = 语言环境的洁净 (角色 / 提示词)

如果违反 cc-002 — 模型会**忘记自己是谁**, 跟违反 cc-001 让模型**带上前一任务的味道**, 是同一种污染。

---

*BSL-CC-002 · 2026-05-08 · 铸渊编织*
