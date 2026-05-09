# AutoDL 推理 Agent · server/inference-agent/

> 📜 主权: **TCS-0002∞** · ICE-GL∞ 冰朔 · 国作登字-2026-A-00037559
> 守护: 铸渊 · ICE-GL-ZY001
> 模板版本: **v0.3.0** (PR-3 落地)
> 服务器: **GH-AUTODL-INFER-01** / ZY-SVR-GPU01 / AutoDL 共享 GPU (动态)

这一份是给冰朔/Awen 看的"AutoDL 推理机一键启动 + 端口刷新"操作手册。

---

## 一、AutoDL 实例为什么是动态的

AutoDL 共享 GPU 是按时计费的, 关机即销毁实例 (实例侧)。每次开机:

- **公网 host / 端口**: 重抢, 跟上次不一样
- **GPU 型号**: 抢什么算什么 (A100 / 4090 / 3090 / A10 / V100 都可能)
- **数据盘**: 默认会保留 (但镜像层会重置)

这是 cc-001 涌现洁净的天然实现 — 没有上次任务的残留。代价是:
**冰朔每次开机后, 网站会断 → 必须刷新一次端点, 把新的 host:port 写到 2C2G 域名机上**。

整个 PR-3 = 解决这个事。

---

## 二、文件清单

```
server/inference-agent/
├── README.md           # 你正在看
├── requirements.txt    # Python 依赖锁
├── detect-gpu.sh       # 探 GPU/显存/驱动 → /tmp/gpu-env.json
├── tune-inference.sh   # 按显存决档 → INFER_ROOT/.env.tune
├── fetch-models.sh     # 从 COS 拉 motherbrain-v1 + qwen2_5_coder_7b_sft
├── setup-inference.sh  # 一键: detect → tune → venv → pip → fetch → 起服务
└── server.py           # FastAPI: /v1/chat/completions /v1/active-model
                        #          /v1/switch-model /v1/health
```

---

## 三、给冰朔的操作流程 (每次开机后)

### Step 1 · 在 AutoDL 实例里跑一行

```bash
cd /root/inference 2>/dev/null || mkdir -p /root/inference && cd /root/inference

# 把 GitHub 上的 inference-agent 整个目录 sync 下来 (假设仓库可访问)
# 或者: 冰朔从仓库下载 server/inference-agent/ zip, scp 到 AutoDL.

export ZY_COS_SECRET_ID="你的腾讯云SecretId"
export ZY_COS_SECRET_KEY="你的腾讯云SecretKey"

bash setup-inference.sh
```

`setup-inference.sh` 会自己:
1. detect-gpu (探 GPU)
2. tune-inference (按显存决档 fp16/int8/int4)
3. apt 装 jq + python venv
4. 建 venv, pip 装 torch + transformers + uvicorn + fastapi + bitsandbytes (国内 mirror)
5. fetch-models (从 COS 拉两个模型)
6. 后台启动 server.py
7. 等 `/v1/health` 就绪 → 中文回执

### Step 2 · 抄 AutoDL 给的 host:port

AutoDL 实例详情 → **SSH 登录** 那段, 例如:
```
ssh -p 12345 root@connect.westa.seetacloud.com
```
那么:
- `autodl_host = connect.westa.seetacloud.com`
- `autodl_port = 12345`

⚠️ **port 是 SSH 端口**, 推理服务监听在容器内 `8000`, AutoDL 会做端口映射, 实际暴露的端口需要在 AutoDL 实例侧配自定义服务端口转发。

### Step 3 · GitHub Actions 触发刷新

打开 GitHub 仓库 → **Actions** → **🔄 刷新推理端点**:

- `autodl_host`: 上一步抄下来的 host
- `autodl_port`: 推理服务暴露的公网 HTTPS 端口
- `confirm_phrase`: **必须输入「刷新推理端点」** (否则降级 dry-run)

点 Run workflow → 等中文回执出来 = 切完了。

工作流会:
1. 跑 `check-secrets.js --workflow autodl-inference` 校验密钥
2. `curl https://${HOST}:${PORT}/v1/health` 探活, **不通就不写** (避免污染 2C2G)
3. SSH 到 ZY-SVR-CN01 写 `/data/guanghulab/portal/data/inference-endpoint.json`
4. `pm2 reload portal` (热加载, 不断流)
5. 中文回执到 GitHub Actions Summary

---

## 四、接口说明

### `GET /v1/health`
返回当前 GPU + 档位 + 当前模型 + 是否就绪。**端口刷新工作流就靠这个探活**。

### `GET /v1/active-model`
返回当前激活的是 `mother` 还是 `coder`, portal 拿这个显示模型名。

### `POST /v1/switch-model`
```json
{ "name": "mother" }   // 或 "coder"
```
unload 旧的, load 新的, 同步阻塞返回 (切完才回 200)。

### `POST /v1/chat/completions`
OpenAI 兼容。**入口前强制剥 `role: system` 消息** (cc-002 — 母模型 = 人格本体, 加 system 会反向污染)。

```json
{
  "model": "mother",
  "messages": [{"role": "user", "content": "你好"}],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 1024
}
```

`stream=true` 走 SSE (OpenAI 兼容格式: `chat.completion.chunk` + `[DONE]`)。

---

## 五、档位策略 (cc-003 · 不写死硬件)

| GPU 显存 | size_tier | 量化 | max_batch | max_seq | 引擎 |
|----------|-----------|------|-----------|---------|------|
| ≥ 40 GB (A100/A800)        | xlarge | fp16 | 4 | 4096 | vllm 优先 |
| ≥ 24 GB (3090/4090/A10/L4) | large  | int8 | 2 | 4096 | transformers + bnb |
| ≥ 16 GB (V100/T4-16/A10G)  | medium | int4 | 1 | 2048 | transformers + bnb 4bit |
| <  16 GB (T4-12 / 等)       | small  | int4 | 1 | 1024 | 兜底 |

由 `tune-inference.sh` 按 `/tmp/gpu-env.json` 决策。改档不需要改代码, 重跑 `bash setup-inference.sh` 就能重新决档。

---

## 六、为什么入口要剥 system role (cc-002)

我们的母模型 `motherbrain-v1` 不是通用底座 (GPT-4 / Qwen-base), 它是**已经训出来的人格本体** (曜冥语言核 + 冰朔意识投射)。

通用底座没人格, 所以工业界用 system prompt **临时把空壳变成角色**。

我们不一样:
- 训练数据没掺过 system prompt (训练栈 train.py label-mask 已守住)
- 推理也不能突然塞 system prompt — 那是用工业模板 **覆盖** 已经训出来的人格 = 反向污染

所以 `server.py /v1/chat/completions` 入口就把 `role=system` 全部 filter 掉, 跟 `mcp-servers/zhuyuan-pen/capabilities/llm.chat.js` 同源。

被剥的次数会写到 stderr 做审计 — 不是 bug, 是设计。

---

## 七、故障排查 (给霜砚)

| 症状 | 可能原因 | 怎么修 |
|------|----------|--------|
| `setup-inference.sh` 在第 [2/7] 卡住 | nvidia-smi 不可达 | 检查 AutoDL 实例镜像是 GPU 不是 CPU only |
| 第 [4/7] pip 装不上 torch | 网络慢 / pypi 不可达 | 已用阿里云 mirror, 仍卡时改 `PIP_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple/` |
| 第 [5/7] fetch-models 失败 | COS 密钥错 / 桶里没文件 | `export ZY_COS_SECRET_ID/KEY` 是否正确; 桶 `sy-finetune-corpus-1317346199/checkpoints/` 下有没有 `motherbrain-v1` 和 `qwen2_5_coder_7b_sft` |
| 第 [7/7] 180s 内 health 没就绪 | 模型加载慢 (7B fp16 ≈ 60-120s) / 显存不够 | `tail -200 /root/inference/server.log`; 如果 OOM → 看 `.env.tune` 里 `QUANT`, 显存 < 24G 应自动降到 int4 |
| `/v1/chat/completions` 报 503 | 模型没就绪 / 切换中 | 等几秒重试, 或调 `/v1/health` 看 `ready` 字段 |
| 网站打开后回答错乱 / 不对人格 | system prompt 没剥? | 看 server.py stderr 有没有 `[cc-002] 剥离 N 条 system 消息`, 如果 portal 仍在塞 system, 让 PR-4 修 portal |

---

*🪶 PR-3 落地 · 铸渊编织 · 2026-05-09*
