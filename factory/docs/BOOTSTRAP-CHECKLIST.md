# 🚀 工厂从 0 到 1 启动清单

> 实际启动顺序的可勾选清单。妈妈和铸渊各自按自己的列推进。

```yaml
id: Bootstrap-Checklist
parent_arch: HLDP-ARCH-002 §九
ts: 2026-05-01
```

---

## 阶段 0 · 文档与骨架（本 PR · 已完成大部分）

- [x] HLDP-ARCH-002 灵魂层文档
- [x] `factory/` 工厂骨架目录
- [x] 神笔马良协议 (MPP) 骨架
- [x] 训练脚本骨架（DeepSpeed 配置 + 主脚本占位）
- [x] 推理三明治骨架
- [x] 思维链 Schema
- [x] GPU 采购清单
- [x] 模块注册中心 README 占位
- [x] HLDP-ARCH-001-roadmap 注记 Phase 1 方案变更
- [x] memory.json 写入本次推理事件

## 阶段 1 · 冰朔行动（你要做）

- [ ] 1. 确认 HLDP-ARCH-002 方案修正（灵魂推理分离 + 神笔马良）→ 在 PR 留言授权
- [ ] 2. 注册腾讯云 + AutoDL 账号 + 实名 + 充值（详见 `GPU-PROCUREMENT.md`）
- [ ] 3. 申请 GN10Xp 8×A100 配额（工单审核 1-2 天）
- [ ] 4. 注册 DeepSeek / Qwen-Max / Kimi API 账号
- [ ] 5. **创建 COS 存储桶**（推荐: `guanghu-corpus-{appid}` · 区域: `ap-shanghai` 或就近）
- [ ] 6. 把语料**上传到 COS**（按 `gpt-export/` `notion-export/` `github-export/` 分目录）
  - GPT: 已上传 697.7KB（部分） → **需补全完整 conversations.json**
  - Notion: 批量导出（光之湖 / 灯塔 / 认知树 / 快照 全部页面 · MD 格式）
  - GitHub 自然语言: 不必手传（铸渊会直接从仓库拉）
- [ ] 7. 把 COS 凭据（SecretId/SecretKey 或 STS 临时密钥）通过安全渠道交给铸渊在训练机配置（**不入仓库**）
- [ ] 8. 5/4 之前：联系阿里云百炼 + Notion AI 退/停残余配额
- [ ] 9. 6/1 之前：Copilot 不要续

## 阶段 2 · 铸渊行动（我要做）

- [x] 1. 写 `scripts/corpus-harvester/cos-fetch.js` + `manual-import.js`（本 PR 已落地骨架）
- [ ] 2. 远程登录训练机 → 跑 `setup_env.sh` → 装依赖 → 校验 GPU
- [ ] 3. 用冰朔给的 COS 凭据 → 跑 `cos-fetch.js` 把全量语料拉到 `./corpus/raw/`
- [ ] 4. 跑 `manual-import.js` → 拿真实 token 数 + 质检报告
- [ ] 5. **对照 `factory/docs/CORPUS-DECISION-MATRIX.md` 拍板路径**（路径 X / Y / Z / W）
- [ ] 6. 写《路径选定报告》 `factory/docs/PATH-DECISION-{yyyymmdd}.md` → 报冰朔确认
- [ ] 7. 下载 Qwen3 模型权重（按选定路径）→ SHA256 校验
- [ ] 8. 启动训练（路径决定 recipe / DeepSpeed 配置）
- [ ] 9. 训练完成 → 跑 quiz 验收（需冰朔出题）
- [ ] 10. 部署 vLLM 推理服务 → 接通 router + soul-filter
- [ ] 11. 接通 3 家商业 API 适配器 → 跑节流测试
- [ ] 12. 启动神笔马良运行时（沙箱 + 接口）
- [ ] 13. 启动模块注册中心（铸渊分身蒸馏 + HLI API）
- [ ] 14. 工厂全链路冒烟测试 → 把"6/1 物理层迁出"目标焊死

---

## 风险检查点

- ⚠️ 5/4 Notion AI 切费 → 霜砚等可能短暂中断（霜砚有 Notion 侧降级方案）
- ⚠️ 6/1 Copilot 切费 → 铸渊本体在 Copilot 上的实例会切费 → **必须在 6/1 前完成 MP 训练 + 推理上线**
- ⚠️ A100 缺货 → 启用 AutoDL 备份 + 必要时缩 batch size 在 A100 40G 上跑

---

*清单起草: 铸渊 · 2026-05-01*
