# 光湖灯塔 · 国内主服务器部署模板 (lighthouse-cn)

> 📜 Sovereign: **TCS-0002∞** · ICE-GL∞ 冰朔 · 国作登字-2026-A-00037559
> 守护: 铸渊 · ICE-GL-ZY001
> 模板版本: **v0.1.0**

这一份文档是**给霜砚和冰朔看的部署日志**——铸渊在国内灯塔服务器上做了什么、装在哪、占了哪个端口、日志在哪、出错怎么修，全部写清楚。

---

## 一、服务器现状（来自冰朔同步）

| 项目 | 信息 |
|------|------|
| 实例 | `ins-dacj5t5a` · **GH-CVM-MAIN-PROD-01** |
| 规格 | 蜂驰型 BF1.LARGE16 · 4C16G |
| 系统 | Ubuntu 22.04 LTS · 内核 5.15.0-177-generic |
| 公网 IP | `43.139.251.175` · 5Mbps |
| 内网 IP | `172.16.0.12` |
| 地域 | 广州六区 |
| 系统盘 | 50G SSD（`/`） |
| **数据盘** | `disk-crtigr8` · GH-CVM-DATA-01 · **100GB ext4 已挂载 `/data`** · fstab 自动挂载 |
| 安全组 | `sg-6lewq1ur` · 已开 22/80/443/3000/ICMP，其余拒绝 |
| 默认登录用户 | `ubuntu`（需 `sudo -i` 切 root 后再跑 bootstrap） |

> ⚠️ 系统盘只有 50G，**Gitea 仓库数据 / Docker 镜像 / Runner 缓存全部走 `/data`**。bootstrap.sh 已强制把这些目录都挂到 `/data` 下。

---

## 二、bootstrap 后服务器目录结构

```
/data/                          # 数据盘 (100G, 持久数据全在这)
├── lighthouse/
│   ├── docker-compose.yml      # Gitea + Postgres + Redis + Runner 编排
│   ├── .env                    # 编排环境变量 (含 GITEA_DB_PASS)
│   ├── gitea/                  # Gitea 数据目录 (repo / lfs / avatars / log)
│   │   └── conf/app.ini        # Gitea 配置 (从 app.ini.template 渲染)
│   ├── postgres/               # PostgreSQL 数据目录
│   ├── redis/                  # Redis 持久化目录
│   ├── runner/                 # Gitea Actions Runner 缓存
│   └── backup/                 # 定时备份输出
├── docker/                     # Docker 镜像/容器存储 (daemon.json 指向)
├── cos-cache/                  # COS 拉取的搬家包临时缓存
├── pm2/                        # PM2 守护进程目录 (PM2_HOME)
└── logs/
    ├── gitea/
    ├── nginx/
    └── runner/

/opt/guanghu/                   # 系统盘 (代码 / 进程, 走标准插座)
├── _active/                    # 当前活跃通道
├── _archive/                   # 归档通道
├── _logs/                      # 部署回执日志 (lighthouse-bootstrap-*.json)
├── _manifest/                  # function-manifest.json
├── _secrets/                   # chmod 700, 仅 root 可读
└── lighthouse-cn/              # 本模板的当前副本 (update 阶段同步)

/etc/nginx/sites-available/lighthouse.conf   # Nginx 反代配置
/etc/docker/daemon.json                      # Docker daemon 镜像加速 + data-root
/etc/apt/sources.list                        # 阿里云 APT 镜像
/etc/apt/sources.list.d/docker.list          # 阿里云 Docker 镜像源
```

---

## 三、端口分配

| 端口 | 用途 | 监听地址 | 是否对公网 |
|-----:|------|----------|------------|
| 22   | 系统 SSH | `0.0.0.0` | ✅ |
| 80   | Nginx HTTP | `0.0.0.0` | ✅ |
| 443  | Nginx HTTPS（备案后启用）| `0.0.0.0` | ✅ |
| 2222 | Gitea SSH（git 协议）| `0.0.0.0` | ⚠️ 安全组未开，需要时再开 |
| 3000 | Gitea HTTP | `127.0.0.1`（内部）+ `0.0.0.0`（安全组开了，备案前先用）| ✅ |
| 3100 | 灯塔总控台 API（PM2 进程 lighthouse-console）| `127.0.0.1` | ❌（仅 Nginx 反代访问）|
| 39000 | channel-switcher（标准插座沿用）| `127.0.0.1` | ❌ |

---

## 四、装了什么软件

| 软件 | 版本 | 来源 | 备注 |
|------|------|------|------|
| APT 源 | ubuntu jammy | `mirrors.aliyun.com` | `get.docker.com` 国内被墙，必须走阿里云 |
| Docker CE | latest stable | `mirrors.aliyun.com/docker-ce` | daemon.json 指向 `/data/docker` |
| Compose | plugin v2 | `docker-compose-plugin` apt 包 | 不从 GitHub release 拉 |
| Node.js | 20.x | NodeSource → fallback nvm（国内镜像）| `npm config set registry https://registry.npmmirror.com` |
| PM2 | latest | npmmirror | `PM2_HOME=/data/pm2` |
| Nginx | apt 默认 | jammy 仓库 | 反代见 `nginx/lighthouse.conf` |
| Gitea | `1.21.11` | docker hub（走腾讯云/USTC 镜像加速）| Actions 已启用 |
| PostgreSQL | `15-alpine` | docker hub | Gitea 后端 DB |
| Redis | `7-alpine` | docker hub | Gitea 缓存 |
| act_runner | `0.2.10` | docker hub | Gitea Actions 自托管 runner |
| certbot | apt 默认 | jammy 仓库 | 备案后用于 Let's Encrypt |
| fail2ban | apt 默认 | jammy 仓库 | 默认规则 |
| ufw | apt 默认 | jammy 仓库 | 22/80/443/3000/2222 已放行 |

---

## 五、部署 / 更新 / 回滚（手动触发）

部署完全通过 GitHub Actions 手动触发，**冰朔在仓库点一下按钮就能跑**：

1. 打开 `Actions` → **`lighthouse-cn-deploy`** workflow
2. 点 `Run workflow`
3. 选参数：
   - `server_target`: `main`（主服务器）/ `backup`（备用机，未购则跳过）
   - `stage`: `bootstrap`（首次）/ `update`（同步代码）/ `rollback`（回滚 compose）
4. 点击 **Run workflow** 启动

执行流程：
1. checkout 当前仓库
2. 写入 SSH 私钥（来自 `ZY_LIGHTHOUSE_KEY`）
3. `rsync` 把 `server/setup/lighthouse-cn/` 推到 `/opt/guanghu/lighthouse-cn/`
4. SSH 远程执行 `bash /opt/guanghu/lighthouse-cn/bootstrap.sh STAGE=$stage`
5. 拉回 `/opt/guanghu/_logs/lighthouse-bootstrap-*.json` 作为 artifact

---

## 六、首次 bootstrap 后的人工步骤

`bootstrap.sh` 自动化做完前 8 步后，**有 1 件事必须人工**：

1. **拿 Gitea Actions Runner 注册 token**
   - 浏览器打开 `http://43.139.251.175:3000/`
   - 用 `ZY_GITEA_ADMIN_USER` / `ZY_GITEA_ADMIN_PASS` 登录
   - Site Administration → Actions → Runners → **Create new Runner**，复制 token
   - 把 token 配回 GitHub Secrets `ZY_GITEA_RUNNER_TOKEN`
2. 在 GitHub Actions 重跑 workflow，选 `stage=update`
   - 这次会带着 token 启 `gitea-runner` 容器（`docker compose --profile runner up -d`）

---

## 七、故障排查（霜砚常用）

### 7.1 Docker / Compose

| 现象 | 原因 | 处置 |
|------|------|------|
| `docker compose pull` 卡住 | docker hub 国内被墙 | 检查 `/etc/docker/daemon.json` 的 `registry-mirrors` 是否生效；`systemctl restart docker` |
| `pull access denied` | 镜像名错或镜像源未生效 | `docker info | grep -A 5 Mirrors` 确认加速器 |
| OOM killed | 4C16G 资源紧张 | `docker stats` 查内存，必要时 `docker compose stop gitea-runner` |
| 容器起不来报"permission denied on /data/..." | UID 不对 | `chown -R 1000:1000 /data/lighthouse/gitea`（Gitea 容器 USER_UID=1000）|

### 7.2 Gitea

| 现象 | 处置 |
|------|------|
| Web UI 502 | `docker logs lighthouse-gitea --tail 100`；DB 没起来：`docker logs lighthouse-gitea-db` |
| 管理员密码忘了 | `docker exec -u git lighthouse-gitea gitea admin user change-password --username bingshuo --password 新密码` |
| Runner 注册失败 `401` | token 过期/已用过；重新到 Site Admin → Runners 拿新 token |
| Push 大文件 OOM | Gitea 容器加 `LFS`，并把 `git config http.postBuffer 524288000` |

### 7.3 Nginx

| 现象 | 处置 |
|------|------|
| `nginx -t` 报错 | 看 `/etc/nginx/sites-enabled/lighthouse.conf`，常见是 upstream 名拼错 |
| `502` | 后端没起：`curl 127.0.0.1:3000/api/v1/version`；总控台未启动是预期行为，会返回 503 |
| 访问慢 | 5Mbps 带宽限制；大文件请走 COS 直链 |

### 7.4 防火墙 / 安全组

| 现象 | 处置 |
|------|------|
| 外网访问不到 3000 | 腾讯云控制台安全组 `sg-6lewq1ur` 是否放行 3000；`ufw status` 是否 allow |
| SSH 连不上 | 安全组 22 必须开；`fail2ban-client status sshd` 看是否被封 IP |

### 7.5 数据盘

| 现象 | 处置 |
|------|------|
| `df -h /data` 接近满 | `du -sh /data/*` 找大目录；优先清 `/data/cos-cache/` |
| 重启后 `/data` 不见了 | `mount /data` 手动挂载；检查 `/etc/fstab` 是否丢行 |

---

## 八、备份

`bootstrap.sh` 当前**未启用自动备份**（v0.1）。手动备份命令：

```bash
# Gitea repo + db 备份到 /data/lighthouse/backup/
docker exec -u git lighthouse-gitea gitea dump -c /data/gitea/conf/app.ini -t /tmp
docker cp lighthouse-gitea:/tmp/gitea-dump-*.zip /data/lighthouse/backup/
docker exec lighthouse-gitea-db pg_dump -U gitea gitea | gzip > /data/lighthouse/backup/db-$(date +%Y%m%d).sql.gz
```

后续 v0.2 会加 cron + COS 增量上传。

---

## 九、和 GitHub 仓库的对应关系

| 本目录文件 | GitHub workflow / 脚本 |
|------------|------------------------|
| `bootstrap.sh` | `.github/workflows/lighthouse-cn-deploy.yml` SSH 执行 |
| `docker-compose.yml` | rsync 推到 `/data/lighthouse/docker-compose.yml` |
| `gitea/app.ini.template` | bootstrap.sh sed 渲染到 `/data/lighthouse/gitea/conf/app.ini` |
| `nginx/lighthouse.conf` | bootstrap.sh 拷到 `/etc/nginx/sites-available/` |
| `gitea-secrets-template.yaml` | 灯塔起来后导入 Gitea Repo Settings → Secrets |
| `migration-checklist.md` | 给霜砚的搬家清单 |

---

## 十、更多

- 神笔马良工具合成器：见 `mcp-servers/zhuyuan-pen/README.md`
- 搬家 COS 中转：见 `scripts/migration/snapshot-to-cos.js` 与 `restore-from-cos.sh`
- 工作流转换：见 `scripts/migration/convert-workflows.js`
- 搬家进度看板：仓库根 `DASHBOARD.md` → "光湖搬家进度" 段
