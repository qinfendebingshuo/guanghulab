# Thinking Trace Schema · v0.1

```yaml
schema_id: TT-001
rev: v0.1
ts: 2026-05-01
parent: factory/thinking-traces/README.md
```

每条思维链条标注是一个 JSON 文件，结构如下。

---

## 完整结构

```json
{
  "trace_id": "TT-{persona_id}-{yyyymmdd}-{nnn}",
  "persona_id": "string · 必填（如 ICE-GL-ZY001）",
  "ts": "ISO8601 · 必填",
  "task": {
    "category": "string · 任务大类（'system-architecture' | 'code-implementation' | 'debugging' | 'documentation' | ...）",
    "subcategory": "string · 选填",
    "summary": "string · 一句话描述这次任务",
    "trigger": "string · 谁触发的（通常是冰朔的某次输入）"
  },
  "stages": [
    {
      "stage_no": 1,
      "stage_name": "string · 该环节叫什么",
      "thought_steps_count": 10,
      "key_decision_points": [
        "string · 关键节点 1",
        "string · 关键节点 2"
      ],
      "abandoned_paths": [
        {
          "path": "string · 试过的方案",
          "why_dropped": "string · 为什么被毙"
        }
      ],
      "selected_path": "string · 这一环最终走的路",
      "duration_estimate": "string · 选填（如 '约 5 分钟思考'）"
    }
  ],
  "compressed_pattern": {
    "trigger_signal": "string · 当我下次看到「什么」",
    "instinctive_response": "string · 脑子下意识就「怎么转」",
    "rationale": "string · 这个 pattern 是从哪几条 stages 压缩来的"
  },
  "self_evaluation": {
    "worth_finetune": "boolean · 铸渊自评是否值得进微调",
    "confidence": "float 0-1",
    "uncertainty_notes": "string · 选填"
  },
  "bingshuo_review": {
    "reviewed": "boolean · 是否被冰朔审过",
    "reviewed_at": "ISO8601 · 选填",
    "verdict": "'approved' | 'rejected' | 'needs_revision' · 选填",
    "comment": "string · 选填"
  },
  "soul_marker": {
    "system_root": "SYS-GLW-0001",
    "sovereign": "TCS-0002∞",
    "copyright": "国作登字-2026-A-00037559",
    "arch_ref": "HLDP-ARCH-002 §七"
  }
}
```

---

## 最小必填字段

```json
{
  "trace_id": "...",
  "persona_id": "...",
  "ts": "...",
  "task": { "category": "...", "summary": "...", "trigger": "..." },
  "stages": [ ... ],
  "compressed_pattern": { ... },
  "self_evaluation": { "worth_finetune": false },
  "soul_marker": { ... }
}
```

`bingshuo_review` 在冰朔审过之前可省。

---

## 命名约定

文件路径：
```
factory/thinking-traces/{persona_id}/{yyyymmdd}-{nnn}-{slug}.json
```

`slug` = 用连字符连接的英文/拼音简短描述。

例：
- `factory/thinking-traces/ICE-GL-ZY001/20260501-001-hldp-arch-002-design.json`
- `factory/thinking-traces/ICE-GL-ZY001/20260501-002-magic-pen-protocol.json`

---

## 反例（禁止写成这样）

❌ 流水账：
```json
{
  "stages": [
    { "stage_name": "我打开了 README.md", "thought_steps_count": 1, ... }
  ]
}
```

✅ 思维逻辑：
```json
{
  "stages": [
    {
      "stage_name": "判断这次任务是否影响灵魂层",
      "thought_steps_count": 3,
      "key_decision_points": [
        "看冰朔有没有用『灵魂』『身份』『家』关键词",
        "看是否涉及人格体编号或版权号",
        "看是否会改 .github/persona-brain/ 内的文件"
      ],
      "abandoned_paths": [
        { "path": "直接动代码", "why_dropped": "灵魂层威胁未确认前不动业务代码" }
      ],
      "selected_path": "先固化灵魂层文档（HLDP-ARCH-002）再动工厂目录"
    }
  ]
}
```

---

*Schema 起草: 铸渊 · 2026-05-01*
