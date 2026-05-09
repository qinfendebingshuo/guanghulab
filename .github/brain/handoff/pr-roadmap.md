# 国内搬家 · 6 棒路线图

> 📜 主权: TCS-0002∞ · 国作登字-2026-A-00037559
> 守护: 铸渊 · ICE-GL-ZY001
> 创建: 2026-05-09 · PR-1

## 一图看全貌

```
冰朔域名 (guanghulab.com · 已备案 · LE 续期到 2026-08-07)
         │
         ▼
[ZY-SVR-CN01 · 广州 2C2G · 唯一对外]
   ├── nginx (443/80)
   ├── portal (Express + 静态)        ← PR-4
   │     ├── data/conversations.sqlite (对话历史)
   │     └── data/inference-endpoint.json ← 由 PR-3 写
   ├── secrets-vault (/admin/secrets) ← PR-5
   ├── zhuyuan-pen (本地 socket)
   └── forgejo (/git, 内嵌轻量)       ← PR-6
                │
                │ HTTPS
                ▼
[ZY-SVR-GPU01 · AutoDL 动态]
   └── inference-agent (FastAPI · OpenAI 兼容)  ← PR-3
        ├── 母模型 motherbrain-v1
        └── 编程模型 qwen2_5_coder_7b_sft
        (二选一动态切换)
                ▲
                │ 模型 checkpoints
                │
[COS · sy-finetune-corpus-1317346199 · 已有]
   ├── checkpoints/motherbrain-v1/
   ├── checkpoints/qwen2_5_coder_7b_sft/
   └── lighthouse-migration/  ← PR-6 搬家包
```

## 6 棒清单

| 棒次 | PR  | 范围 | 触发口令 | 状态 |
|---|---|---|---|---|
| **001** | PR-1 | 隔离防火带 + 接力棒机制 + 给霜砚移交骨架 | (本棒进行中) | 🟡 |
| **002** | PR-2 | 域名机一键部署 (bootstrap + 误触锁 + 自动回滚) | "铸渊。第 2 棒。开发授权。" | ⚪ |
| **003** | PR-3 | AutoDL 推理 Agent + 端口刷新工作流 | "铸渊。第 3 棒。开发授权。" | ⚪ |
| **004** | PR-4 | 双层 Web Portal (人格层 / 开发层 + 对话历史) | "铸渊。第 4 棒。开发授权。" | ⚪ |
| **005** | PR-5 | 自部署密钥管理页 (AES-256-GCM + 中文 UI) | "铸渊。第 5 棒。开发授权。" | ⚪ |
| **006** | PR-6 | 仓库搬家包 + Forgejo 自托管 git | "铸渊。第 6 棒。开发授权。" | ⚪ |

## 依赖图

```
PR-1 (隔离 + 接力棒) ─── 阻塞所有后续
   │
   ├── PR-2 (域名机) ─── 阻塞 PR-4, PR-5, PR-6
   │     │
   │     ├── PR-4 (Portal)
   │     ├── PR-5 (Secrets Vault)
   │     └── PR-6 (Forgejo + 搬家)
   │
   └── PR-3 (AutoDL)  ← 与 PR-2 可并行 (但 PR-4 需要二者都合)
```

## 共振因果链速查

| 棒次 | cc-001 (硬件洁净) | cc-002 (no system prompt) | cc-003 (动态适配) | cc-004 (强制自主) | cc-005 (记忆即路) |
|---|---|---|---|---|---|
| PR-1 | — | — | — | ✅ | ✅✅ |
| PR-2 | — | — | ✅ (size_tier=tiny) | ✅✅ (误触锁/自动回滚) | — |
| PR-3 | ✅✅ (新 GPU 不带 V100 残留) | ✅✅ (推理强制剥 system) | ✅✅ (detect-gpu) | ✅ (中文回执) | — |
| PR-4 | — | ✅✅ (前端不传 system) | — | ✅ (中文 UI) | — |
| PR-5 | — | — | — | ✅✅ (Awen 看得懂的中文密钥页) | — |
| PR-6 | ✅ (国内 git 不带境外残留) | — | ✅ (tiny tier 内存约束) | ✅✅ (一键打包/恢复) | — |

## 给冰朔的总周期回执

每一棒合并后, 冰朔下一句话只需:

```
铸渊。第 N 棒。开发授权。
```

铸渊会自动:
1. 读 `baton-NNN-*.md` (上一棒留的开机包)
2. 走 walk-the-path → 答自检题 → 进入状态
3. 干完活, 写下一棒 baton, 给中文回执

冰朔不需要每次都讲一大堆。

---

*🪶 6 棒走完 · 国内搬家完成 · 神笔马良落地*
