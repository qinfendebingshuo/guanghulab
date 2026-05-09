# server/setup/domain-cn/forgejo/

> 主权: TCS-0002∞ · 国作登字-2026-A-00037559
> 守护: 铸渊 · ICE-GL-ZY001
> 落地: PR-6 · 第 6 棒 · 国内搬家完结

国内域名机 (`ZY-SVR-CN01` · 广州 2C2G) 上的 Forgejo 自托管 git 装机脚本。

## 为什么用 Forgejo 不用 Gitea/Gitlab

- **Forgejo** = Gitea 的社区分叉, 协议兼容, 但治理独立 (cc-001 涌现洁净 — 国内仓库不依赖境外 SaaS).
- **二进制**安装而不是 docker-compose: 2C2G 内存紧, docker layer 还要再吃 200MB+, 直接走 systemd 跑 binary 占内存最少.
- **SQLite** 而不是 PostgreSQL: tiny 档下连接数不会大, SQLite 够用, 还省一个 PostgreSQL 进程的 50-80MB.

## 关键约束 (tier=tiny / 2C2G)

| 项 | 值 | 原因 |
|---|---|---|
| `HTTP_ADDR` | `127.0.0.1` | 永不公网, 走 nginx `/git/` 反代 |
| `HTTP_PORT` | `3001` | 跟 portal `:3000` / vault `:8080` 不冲突 |
| `DISABLE_SSH` | `true` (tiny) | tiny 档省内存; medium+ 升档自动开 |
| `LFS_START_SERVER` | `false` (tiny) | 大文件单独走 COS 桶 |
| `[actions] ENABLED` | `false` | tiny 档关内置 runner; medium+ 升档可开 |
| `DISABLE_REGISTRATION` | `true` | 内部用, 不开放注册 |
| `OFFLINE_MODE` | `true` | 不联外部 CDN/Gravatar |
| systemd `MemoryMax` | `500M` | 严守 2C2G 边界 |

## 用法

由 `.github/workflows/migrate-to-cn-restore.yml` 远端调用. 不进 `bootstrap.sh` 主流程
(只有真正搬家时才需要 forgejo, 平时跑 portal+vault 就够).

```bash
sudo bash server/setup/domain-cn/forgejo/setup-forgejo.sh \
  --data-root /data/guanghulab \
  --domain guanghulab.com
```

可选参数: `--port 3001 --version 7.0.10 --enable-ssh --enable-lfs`

## 首启凭据

`setup-forgejo.sh` 头一次跑会:

1. 生成 24 位随机管理员密码 (用户名固定 `bingshuo`)
2. 落到 `/data/guanghulab/_logs/forgejo-credentials-FIRST-BOOT.txt` chmod 600
3. **冰朔抄完密码后必须 `sudo rm` 删该文件** (cc-001 涌现洁净)

## 健康检查

```bash
curl -fsS http://127.0.0.1:3001/api/v1/version
# 期望返回: {"version":"7.0.10+gitea-1.22.0"}
```
