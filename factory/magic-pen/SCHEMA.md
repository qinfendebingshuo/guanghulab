# MPP-001 · 神笔接口契约

```yaml
schema_id: MPP-001
rev: v0.1
ts: 2026-05-01
parent: factory/magic-pen/README.md
status: draft（实现等 1.5B MP）
```

---

## 1. `pen.write` 输入

```json
{
  "intent": "string · 必填 · 母语自然语言描述",
  "context": {
    "task_category": "string · 选填（'data-process' | 'api-call' | 'file-op' | ...）",
    "persona_id": "string · 必填（笔属于哪个人格体）",
    "upstream_inputs": "any · 选填（上游环节的产物）"
  },
  "options": {
    "sandbox": {
      "lang": "'python' | 'node' | 'shell' · 默认 python",
      "timeout_ms": "int · 默认 30000",
      "memory_mb": "int · 默认 512",
      "network": "'none' | { allow: string[] } · 默认 none",
      "fs": "'none' | 'tmp' | { allow_paths: string[] } · 默认 tmp"
    },
    "persist_hint": "'auto' | 'erase' | 'keep' | 'share' · 默认 auto（让人格体决策）"
  }
}
```

## 2. `pen.write` 输出

```json
{
  "pen_id": "string · MPP-{persona}-{yyyymmdd}-{nnn}",
  "code": "string · 笔生成的语言源代码",
  "lang": "string · 与 sandbox.lang 一致",
  "execution": {
    "status": "'success' | 'error' | 'timeout'",
    "stdout": "string",
    "stderr": "string",
    "result": "any · 主要返回值（结构化）",
    "duration_ms": "int"
  },
  "suggestion": "'erase' | 'keep' | 'share' · 1.5B MP 给的建议",
  "audit": {
    "syslog_id": "string · 必有（即使 erase 也保留审计）",
    "intent_hash": "string · sha256(intent)",
    "code_hash": "string · sha256(code)"
  }
}
```

## 3. 人格体最终决策（在 `suggestion` 之上拍板）

```
final_action = persona.decide(suggestion, execution_result)
  → 'erase' | 'keep' | 'share'
```

- `erase` → 沙箱产物销毁，仅保留 audit 记录
- `keep`  → 持久化到 `.github/persona-brain/{persona_id}/pen-private/{pen_id}/`
- `share` → 投递到 `factory/module-registry/inbox/{pen_id}/` 等待铸渊分身评审

## 4. 共享上交格式（share 路径）

share 时必须附带 manifest：

```json
{
  "pen_id": "...",
  "persona_id": "...",
  "intent_summary": "string · 一句话说明这工具是干嘛的",
  "use_cases": ["string", "..."],
  "io_contract": { "input_schema": {...}, "output_schema": {...} },
  "dependencies": ["pkg@version", "..."],
  "test_examples": [{ "input": ..., "expected": ... }],
  "shared_at": "ISO8601",
  "copyright": "国作登字-2026-A-00037559"
}
```

## 5. 状态机

```
draft → executing → completed
                   ├─→ erased
                   ├─→ kept (private)
                   └─→ shared (in registry inbox) → reviewed
                                                    ├─→ accepted (in shared lib)
                                                    ├─→ rejected
                                                    └─→ observation
```

## 6. 错误码

| code | meaning |
|---|---|
| `MPP-E001` | intent 不合法（空 / 信息密度过低 / 含敏感信息） |
| `MPP-E002` | 沙箱启动失败 |
| `MPP-E003` | 代码生成失败（API 不通 / 上游模型拒绝） |
| `MPP-E004` | 执行超时 |
| `MPP-E005` | 越权（试图访问黑名单资源） |
| `MPP-E006` | 共享被拒（铸渊分身评审未通过） |

---

*Schema 起草: 铸渊 · 2026-05-01*
