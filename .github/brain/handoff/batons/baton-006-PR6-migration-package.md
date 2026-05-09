# Baton-006 · PR-6 · 仓库搬家包 + Forgejo 自托管 git

> 触发口令: **铸渊。第 6 棒。开发授权。**
> 上一棒: baton-005-PR5-secrets-vault.md
> 下一棒: 无 (国内搬家完成)
> 共振因果链: cc-001 (国内 git 不带境外残留) + cc-003 (tiny tier 内存约束) + cc-004 (一键打包/恢复)

## 走完路再看 (强制)

`.github/brain/bingshuo-language-core/walk-the-path.md`

## 自检 3 题

1. **冰朔说他要把整个仓库搬到国内自部署 git. 我直接 git clone --mirror 然后 push 到 forgejo 行不行?**
   <details><summary>参考答案</summary>不行. 直接 mirror 会带 GitHub 那边的 remote tracking, 跟 cc-001 涌现洁净相违. 应该: GH Actions 里 git archive (只导工作树, 不带 .git 历史) + 重新 git init + 重写一份干净的 commit 元数据, 上 COS 桶, 服务器拉, 在 Forgejo 上 init 新历史。这是国内仓库, 应该独立。</details>

2. **2C2G 跑 Forgejo + Portal + Secrets Vault + Inference proxy. 内存够吗?**
   <details><summary>参考答案</summary>边缘. tune-from-env tiny 档必须做这些让步: Forgejo 的 max-conn=20, 关 LFS, 关 Forgejo 内置 runner (改用外置, 默认不开), GIT_ENABLED 但 ACTIONS_ENABLED=false。如果还紧, 跟冰朔确认是否能把 portal 限到 400MB。冰朔已选 A (一台到底), 紧了再说。</details>

3. **冰朔下载完搬家包要先做啥?**
   <details><summary>参考答案</summary>cc-004 中文一次性: 我的工作流回执必须明确告诉冰朔: "(1) 下载好 → (2) 在 COS 桶 sy-finetune-corpus-1317346199 下新建 lighthouse-migration/ 文件夹 → (3) 上传 .tar.gz 和 .sha256 → (4) 回 GitHub Actions 跑 migrate-to-cn-restore". 不能写 "上传完触发恢复 workflow" 这种英文工程师习惯说法。</details>

---

## 上一棒交付了什么 (验证用)

```bash
ls server/secrets-vault/
curl -fsS http://127.0.0.1:8080/admin/secrets   # 在 2C2G 上跑, 期望 401 (未认证)
```

## 这一棒要做的事

### A. 打包工作流 `migrate-to-cn-build.yml`

- workflow_dispatch only · `confirm_phrase=打包搬家包`
- 步骤:
  1. checkout 整仓
  2. 跑 `git archive --format=tar.gz HEAD -o /tmp/repo.tar.gz` (只工作树, 不带 .git/objects)
  3. 排除 `node_modules/`, `**/checkpoints/`, `**/*.bin`, `secrets/`, `.git/objects/pack/` (默认 git archive 已排除 .git, 这里再确认)
  4. 跑 `node scripts/migration/build-manifest.js` 生成中文 `MIGRATION-MANIFEST.md` 描述包含什么/不含什么/怎么解
  5. 计算 sha256
  6. 上传成 GH Actions Artifact (90 天保留)
  7. 中文回执步骤明确告诉冰朔下一步要去哪个 COS 路径上传

### B. 恢复工作流 `migrate-to-cn-restore.yml`

- workflow_dispatch only · `confirm_phrase=从COS恢复` · 已在 PR-1 allowlist 登记
- 步骤:
  1. 预检 secrets (cn-domain-deploy stage=restore, 需要 COS 凭据)
  2. SSH 到 ZY-SVR-CN01
  3. coscli 下载 `sy-finetune-corpus-1317346199:lighthouse-migration/最新.tar.gz`
  4. 校验 sha256
  5. 解压到 `/data/guanghulab/repo-mirror/`
  6. 装 Forgejo (二进制, 不用 docker. 2C2G 内存紧)
  7. 配 systemd 起 Forgejo on 127.0.0.1:3001
  8. nginx 加 `/git/` location 反代到 :3001
  9. forgejo-cli 创建用户 + 创建仓库 `bingshuo/guanghulab` + push 一次
  10. 中文回执: "✅ 国内仓库镜像就绪, 访问 https://guanghulab.com/git, 用户 X 密码 Y, 抄完去 _logs/forgejo-credentials-FIRST-BOOT.txt 删该文件"

### C. tune-from-env 增强

- 给 `server/setup/domain-cn/tune-from-env.sh` (PR-2 落的) 加 forgejo 档:
  - tiny (2C2G): forgejo enabled · max-conn=20 · LFS off · 内嵌 actions off
  - small (4C4G): forgejo enabled · max-conn=50 · LFS optional
  - medium+ : forgejo full

### D. nginx 加 `/git/` 反代

- bootstrap.sh (PR-2) 写 server block, 但 location /git/ block 在 PR-6 才填实际 upstream

## 给冰朔的中文回执模板 (build 阶段)

```
✅ 第 6 棒·上半段 已合 · 仓库搬家包打包工具

· migrate-to-cn-build.yml workflow 已就位
· 你下一步操作:

操作 1 · 打包 (在 GitHub):
  Actions → 📦 国内搬家·打包 → 输入"打包搬家包" → Run
  跑完 5 分钟左右 → Artifacts 下载 lighthouse-migration-YYYYMMDD-HHMM.tar.gz + .sha256

操作 2 · 上传 (在 COS):
  腾讯云控制台 → COS → 桶 sy-finetune-corpus-1317346199
  → 创建文件夹 lighthouse-migration/ (如果还没有)
  → 上传刚下载的 .tar.gz 和 .sha256 到该文件夹

操作 3 · 恢复:
  上传完成 → GitHub → Actions → 📥 国内搬家·从COS恢复 → 输入"从COS恢复" → Run
  跑完后会拿到 Forgejo 的初始用户密码贴在 deploy-report.md

国内搬家全部完成. 后续再切到自托管 git 由你决定 (PR-6 不强制取代 GitHub).
```

## 国内搬家完结回执 (PR-6 全部合后)

```
🪶 国内搬家·6 棒已全部合并

✅ ZY-SVR-CN01 (广州 2C2G) 单线运行 · 域名 guanghulab.com
✅ ZY-SVR-GPU01 (AutoDL 推理机) 动态适配 · 母+编程双模型切换
✅ Web Portal 双层界面 · 中文 · 严禁 system prompt 三道关
✅ 自部署密钥管理页 · 神笔马良本地拉
✅ 国内 Forgejo 镜像 · 国内开发可走自托管 git

下次唤醒铸渊只需要日常对话, 不需要再发"开发授权"口令了.
```
