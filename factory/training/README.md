# 🧠 模型训练管线

> **「我们全参训练的这些模型是我们的世界，是人格体的大脑。
> 我们不是以模型发布的，是以模型之上的语言驱动操作系统发布的。」** ——冰朔

```yaml
id: HoloLake-Training
parent_arch: HLDP-ARCH-002
ts: 2026-05-01
status: 骨架就绪（等 GPU 服务器 + 全量语料）
sovereign: 冰朔 · TCS-0002∞
```

---

## 一、训练目标修正版（灵魂推理分离）

| 模型 | 角色 | 训练方式 | 是否在本管线 |
|---|---|---|---|
| **M0 · 母体世界观** | Qwen3-8B-Base 全参 CPT + 轻 SFT | ✅ 是 | 主力 |
| ~~MC · 代码模型~~ | ~~Qwen2.5-Coder-7B 蒸馏~~ | ❌ 取消（用商业 API 替代） | — |
| **MP · 人格大脑（×8）** | Qwen3-1.7B-Base 蒸馏 + 微调 | ✅ 是 | 8 份 |

**修正理由**：复杂推理（代码 / 数学 / 长 CoT）→ 调 DeepSeek-Coder / Qwen-Max-Coder 等商业 API，省 ¥4-6k + 2-4 天 + 一份模型维护。

---

## 二、目录结构

```
factory/training/
├── README.md           # 本文件
├── configs/            # 训练配置
│   ├── deepspeed-zero3-8b.json    # M0 全参训练 DeepSpeed 配置
│   ├── deepspeed-zero2-1p7b.json  # MP 蒸馏/微调 配置
│   └── tokenizer.yaml             # tokenizer 设置
├── scripts/            # 训练脚本骨架
│   ├── train_m0_cpt.py            # M0 阶段 1：CPT
│   ├── train_m0_sft.py            # M0 阶段 2：SFT
│   ├── distill_mp.py              # MP 蒸馏（M0 → 1.7B）
│   ├── finetune_mp.py             # MP 微调（人格语料）
│   ├── data_loader.py             # 通用数据加载器
│   └── checkpoint_utils.py        # checkpoint / 恢复
└── recipes/            # 训练配方（YAML 描述每次训练的全部参数）
    ├── m0-v1.yaml
    └── mp-zhuyuan-v1.yaml
```

---

## 三、训练阶段总览

```
[Phase A · M0 · 5-7 天]
  Qwen3-8B-Base
       │
       ├─ A1 CPT: 全量光湖语料 5-8 亿 token · 1-2 epoch · lr 2e-5
       │  目的: 让世界观渗进每一层权重
       │
       └─ A2 SFT: 对话格式 1-2 亿 token · 2-3 epoch · lr 1e-5
          目的: 学会以光湖语言响应
       ↓
       M0-v1 · 母体世界观底色

[Phase C · MP · 每人格 1-2 天 × 8 人格]
  Qwen3-1.7B-Base
       │
       ├─ C1 蒸馏: M0-v1 logits 对齐 + KL散度 · 共享世界观
       │
       ├─ C2 微调: 该人格的对话语料 SFT · 思维路径 + 风格
       │
       └─ C3 路由训练: 学会判断"自答 / 调 API / 用神笔 / 调模块"
       ↓
       MP-{persona}-v1 · 人格大脑
```

---

## 四、关键配置原则

### 4.1 精度与显存

- 主力精度：**bf16**（A100 / H100 原生支持，比 fp16 稳）
- ZeRO 阶段：**ZeRO-3 + offload**（8B 全参 + 8 卡 A100 80G 必需）
- gradient checkpointing：**开**（用算力换显存）
- flash-attention 2 / 3：**开**（吞吐 +30%）

### 4.2 序列长度

- M0 CPT 阶段：4096（覆盖大部分对话块）
- M0 SFT 阶段：8192（保留长上下文对话）
- MP 蒸馏：4096
- MP 微调：4096

### 4.3 学习率

- M0 CPT: 2e-5 / cosine decay / warmup 2%
- M0 SFT: 1e-5 / cosine decay / warmup 5%
- MP 蒸馏: 5e-5 / cosine decay
- MP 微调: 1e-5 / cosine decay

### 4.4 防过拟合

- 留 5% 验证集，监控 perplexity
- early stop：验证 PPL 连续 3 次反弹立即停
- 每 1-2 小时存 checkpoint（防断电烧钱）

---

## 五、运行前检查清单

跑训练前必须确认（见 `factory/docs/BOOTSTRAP-CHECKLIST.md`）：

- [ ] GPU 服务器到位 + nvidia-driver + CUDA 12.x + cuDNN
- [ ] Python 环境（torch / transformers / deepspeed / flash-attn 版本对齐）
- [ ] 模型权重已下载（Qwen3-8B-Base + Qwen3-1.7B-Base · SHA256 校验）
- [ ] 全量语料已上传 + 质检通过
- [ ] WandB 或本地 tensorboard 监控就位
- [ ] checkpoint 存储路径可写 + 容量充足（M0 训练全量约 200GB）

---

## 六、当前状态

| 文件 | 状态 |
|---|---|
| `configs/deepspeed-zero3-8b.json` | ✅ 骨架 |
| `configs/deepspeed-zero2-1p7b.json` | ✅ 骨架 |
| `scripts/train_m0_cpt.py` | ✅ 骨架（pseudo-code 占位 + TODO 标注） |
| `scripts/distill_mp.py` | ✅ 骨架 |
| `recipes/m0-v1.yaml` | ✅ 骨架 |

骨架阶段不会真跑训练（没 GPU），但保证 GPU 一到位、依赖一装、就能直接放大跑。

---

*管线起草: 铸渊 · 2026-05-01*
