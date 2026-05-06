# 光湖搬家 · 给霜砚的清单

> 📜 Sovereign: TCS-0002∞ · 国作登字-2026-A-00037559
> 守护: 铸渊 · ICE-GL-ZY001
> 更新: 跟着 PR 走，每个里程碑铸渊会回填 ✅

霜砚，搬家流程铸渊全部规划好了。你这边只需要做下面四类事情，**大的环境部署、bootstrap 脚本、密钥布局都不用你动**。

---

## 你的工作面 (4 件)

### 1. 部署日志同步 📒
- 真相源：`server/setup/lighthouse-cn/README.md`
- 每次铸渊在服务器上做了什么，都会写在这一份里——装了什么、装在哪个目录、占了哪个端口、日志在哪、出错怎么修
- 你不需要手动同步，PR 合并后看这一份就行

### 2. 触发 bootstrap（冰朔点击，你陪同看日志）
- 入口：GitHub Actions → **`lighthouse-cn-deploy`** workflow
- 前提：冰朔已配齐 `ZY_LIGHTHOUSE_*` + `ZY_GITEA_*` 等 19 个密钥（见 README §五）
- 第一次跑：`server_target=main`，`stage=bootstrap`
- 看 workflow 跑下来的最后一步 `lighthouse-bootstrap-*.json` 的 artifact，确认 `template_version=0.1.0`、`stage=bootstrap`、`completed_at` 有时间戳

### 3. 代码搬运（COS 中转）
- 冰朔本地跑 `scripts/migration/snapshot-to-cos.js`，把当前 GitHub 仓库打包推到 COS
- 灯塔 bootstrap 完成后，**直接在灯塔服务器**上跑：
  ```bash
  cd /opt/guanghu/lighthouse-cn
  bash /opt/guanghu/lighthouse-cn/restore-from-cos.sh \
    --bucket guanghulab-migration-xxx \
    --region ap-guangzhou \
    --gitea-url http://127.0.0.1:3000 \
    --gitea-user bingshuo \
    --gitea-token <PAT>
  ```
- 这一步会从 COS 拉回 `guanghulab-snapshot.tar.gz`，解包，`git push --mirror` 到 Gitea
- 常见错误：
  - **LFS 大文件**: 看 `restore-from-cos.sh` 输出，会提示 "skipping LFS"，不影响 mirror push
  - **网络断流**: 5Mbps 带宽限制，重试即可（脚本支持断点续传）
  - **Gitea 拒绝 push**: 通常是 PAT 权限不足，需要 `repo:write` + `admin:repo_hook`

### 4. 工作流转换
- bootstrap 后，`.github/workflows/` **不会自动生效**（Gitea 走 `.gitea/workflows/`）
- 在灯塔服务器克隆 Gitea 上的 `guanghulab` 仓库，跑：
  ```bash
  node scripts/migration/convert-workflows.js \
    --from .github/workflows \
    --to .gitea/workflows \
    --report convert-report.json
  ```
- 你 review 一下生成的 `.gitea/workflows/`，看 `convert-report.json` 里 `unconvertible` 列表——这些需要人工调整
- 调整完 push 回 Gitea

---

## 你**不**用做的事

- ❌ 写 / 修改 bootstrap.sh
- ❌ 改 docker-compose.yml
- ❌ 调整 nginx 反代
- ❌ 设计密钥命名
- ❌ 写神笔马良工具合成器
- ❌ 操作 GitHub Actions secrets（那是冰朔的）

如果上面这些有需要变更，**让铸渊提 PR**。

---

## 你的小修小补范围

✅ Gitea Web UI 操作（仓库创建、PR review、Runner 注册）
✅ Nginx 配置微调（比如加一个临时反代）
✅ 看 `docker logs lighthouse-gitea` 定位 bug
✅ 截图给冰朔看的是什么报错

冰朔截图给你时，先到 `README.md §七 故障排查` 找对应章节。

---

## 进度同步

- 进度看板：仓库根 `DASHBOARD.md` → "光湖搬家进度" 段
- 铸渊每完成一个里程碑会在那段打 ✅
