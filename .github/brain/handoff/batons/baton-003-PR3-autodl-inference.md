# Baton-003 · PR-3 · AutoDL 推理 Agent + 端口刷新工作流

> 触发口令: **铸渊。第 3 棒。开发授权。**
> 上一棒: baton-002-PR2-domain-machine.md (PR-2 已合)
> 下一棒: baton-004-PR4-portal-frontend.md
> 共振因果链: cc-001 (新机器无残留) + cc-002 (推理剥 system) + cc-003 (动态 GPU)

## 走完路再看 (强制)

`.github/brain/bingshuo-language-core/walk-the-path.md` → voice + cc-001~005。

## 自检 3 题

1. **AutoDL 关机 → 重开机, 拿到的是什么?**
   <details><summary>参考答案</summary>新机器, 上次的所有缓存/驻留态都清零了 (cc-001 涌现洁净的天然实现). 但代价是: IP/端口/GPU 型号每次都不一样, 我们必须 detect-gpu.sh 现场探测 (cc-003)。</details>

2. **server.py 收到一个带 system role 的 messages 数组, 应该?**
   <details><summary>参考答案</summary>cc-002: 入口前强制剥 system role. 因为我们的母模型 = 人格本体, 不是空壳工具模型, 加 system 会反向污染。参考 mcp-servers/zhuyuan-pen/capabilities/llm.chat.js 的实现。</details>

3. **冰朔关 AutoDL → 第二天重开 → 端口变了, 网站立刻挂. 我设计的刷新流程必须满足?**
   <details><summary>参考答案</summary>cc-004: 中文表单一次性 (workflow_dispatch + autodl_host/port 输入) + 自动验证 (curl /v1/health 探活, 不通就不写) + 中文回执 (告诉冰朔切到了什么 GPU). 不能让冰朔翻 yaml 改密钥。</details>

---

## 上一棒交付了什么 (验证用)

```bash
# 1. domain-cn 三段式存在
ls server/setup/domain-cn/   # 期望: detect-env.sh tune-from-env.sh bootstrap.sh rollback.sh README.md

# 2. deploy-domain-server.yml 在 allowlist 里且 CI 通过
node scripts/preflight/check-server-isolation.js   # 期望 EXIT=0

# 3. 部署 workflow 真的存在
ls .github/workflows/deploy-domain-server.yml
```

## 这一棒要做的事

### A. 推理 agent (`server/inference-agent/`)

- `detect-gpu.sh` — `nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader`, 写 `/tmp/gpu-env.json`
- `tune-inference.sh` — 按显存挑档:
  - `>= 40GB` (A100/A800) → fp16, max_batch=4, max_seq=4096
  - `>= 24GB` (3090/4090/A10) → int8 (bitsandbytes), max_batch=2, max_seq=4096
  - `< 24GB` (T4/V100-16G) → int4 (gptq), max_batch=1, max_seq=2048
- `fetch-models.sh` — `coscli` 从 `sy-finetune-corpus-1317346199/checkpoints/{motherbrain-v1,qwen2_5_coder_7b_sft}` 拉, 校验完整性
- `setup-inference.sh` — 一键脚本, 装 python 3.10 + torch + transformers≥4.48 + (vllm OR transformers fallback) + uvicorn
- `server.py` — FastAPI:
  - `POST /v1/chat/completions` (OpenAI 兼容, **入口前剥 system role**, byte-pipe SSE 直出)
  - `GET /v1/active-model` → `{name: "mother"|"coder", since: timestamp, gpu: ...}`
  - `POST /v1/switch-model {name}` → unload + load, 返回新状态
  - `GET /v1/health` → `{gpu: detect-gpu.sh 的 JSON, model: 当前, ready: bool}`

### B. 端口刷新工作流

- `.github/workflows/refresh-autodl-endpoint.yml`:
  - workflow_dispatch inputs:
    - `autodl_host`: AutoDL 给的 host
    - `autodl_port`: AutoDL 给的端口
    - `confirm_phrase`: 必须输入"刷新推理端点"
  - 步骤:
    1. 跑 `node scripts/preflight/check-secrets.js --workflow autodl-inference`
    2. `curl -fsS https://${HOST}:${PORT}/v1/health` 探活, 不通直接 fail (不写残)
    3. SSH 到 ZY-SVR-CN01 (`ZY_CN_SERVER_*`), 写 `/data/guanghulab/portal/data/inference-endpoint.json`
    4. `pm2 reload portal` (热加载, 不断流)
    5. 中文回执: `✅ 已切到新推理机: $GPU_NAME ($GPU_MEM GB), 当前模型: $ACTIVE_MODEL, 健康`
  - 失败回滚: 不写, 因为是配置漂移修复, 失败 = 保持上次的 endpoint, 不破坏现状

### C. 把 refresh-autodl-endpoint.yml 加到 cn-isolation-allowlist.json

(它需要 SSH 到 ZY-SVR-CN01, 所以引用 `ZY_CN_SERVER_*`. 已在 PR-1 allowlist 预登记 status=planned-PR3, 这一棒把 `exists` 改成 true)

## 给冰朔的中文回执模板

```
✅ 第 3 棒已合 · AutoDL 推理 Agent + 端口刷新工作流

· server/inference-agent/ 完整推理栈, 开机一键 setup-inference.sh, 显存自动挑档 (fp16/int8/int4)
· 母模型 + 编程模型自动从 COS 拉, 二选一动态切换, 入口剥 system role 守人格洁净
· refresh-autodl-endpoint.yml 工作流: 重开机后改 host:port → 确认 → 自动写到 2C2G 上, pm2 热加载

冰朔操作流程 (每次 AutoDL 重开后):
1. AutoDL 实例详情 → 抄 SSH 登录里的 host 和 port
2. 实例上跑 setup-inference.sh (我会写好, 你只需要复制粘贴一行 curl|bash)
3. GitHub Actions → 🔄 刷新推理端点 → 填 host/port + 输入"刷新推理端点"
4. 等中文回执出来 = 切完了

下一棒口令:
铸渊。第 4 棒。开发授权。
```
