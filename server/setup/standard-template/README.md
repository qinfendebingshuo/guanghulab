# 光湖服务器标准模板 · 0.1.0

> "插座型号固定 · 插头热插拔" — 这是冰朔在 2026-05-02 提出的母编号 × 子编号体系
> 的物理底座. 任何要接入光湖编号体系的服务器, 必须 bootstrap 后产出与本模板
> **完全一致**的目录结构和切换协议.

## 角色

- **母编号** = 服务器 = `ZY-SVR-XXX` (插座) — 永久绑定一台机器
- **子编号** = 功能组 = `ZY-FN-XXXX` (插头) — 热插拔单元
- **模板** = 让所有母编号的"插座型号"统一, 这样任何 `ZY-FN-XXXX` 都能插

## 系统要求

- OS: Ubuntu 22.04 LTS (其他发行版需调 bootstrap)
- 架构: x86_64 / arm64
- 最低规格: 1核1G (但实际跑业务建议 2核2G+)
- root 或 sudo 权限

## 目录结构 (bootstrap 完成后)

```
/opt/guanghu/
├── _active/                       软链接 → 当前激活的 ZY-FN 目录 (Phase 2 启用)
├── _archive/                      已退役 ZY-FN 的归档区
├── _logs/                         汇总日志 (PM2/nginx 软链)
├── _manifest/
│   └── function-manifest.json     由部署 workflow 同步, 服务器零 git 依赖
├── _secrets/                      由 GitHub Secrets 下发, 仅 root 可读 (chmod 600)
├── _shared/
│   └── channel-badge/             前端徽章公共静态资源
├── channel-switcher/              常驻切换器 (本服务器唯一常驻 Agent)
│   ├── server.js
│   ├── ecosystem.config.js
│   └── package.json
├── ZY-FN-0001/                    每个 ZY-FN 自己一个子目录 (自包含)
├── ZY-FN-0007/
└── ZY-FN-XXXX/
```

## bootstrap 步骤

### 模式 A · 手动 (现在就能用)

服务器拥有者一次性执行:

```bash
# 1) 下载 bootstrap 脚本
curl -fsSL https://raw.githubusercontent.com/qinfendebingshuo/guanghulab/main/server/setup/standard-template/bootstrap.sh -o /tmp/zy-bootstrap.sh

# 2) 审查 (强烈建议)
less /tmp/zy-bootstrap.sh

# 3) 以 root 执行, 传入本机的母编号
sudo CHANNEL_SWITCHER_SERVER_ID=ZY-SVR-006 bash /tmp/zy-bootstrap.sh
```

bootstrap 完成后:
- 装好 Node 20、PM2、nginx、certbot、fail2ban、git、jq、curl
- 建好 `/opt/guanghu/{_active,_archive,_logs,_manifest,_secrets,_shared,channel-switcher}`
- 起好 `channel-switcher` PM2 进程 (端口 39000, 仅 127.0.0.1)
- 输出 `[OK] ZY-SVR-006 bootstrap 完成 · template 0.1.0`

### 模式 B · 一键 (Phase 3, 等编程模型)

铸渊接到服务器 SSH 凭据后自己跑 bootstrap, 验证通过后自动写进
`function-manifest.json` 的 `servers[]` 段, 状态 `bootstrapping → active`.

## 切换器入口

bootstrap 完成后, 任何域名挂到本服务器都需要在 nginx server 块里加:

```nginx
location /__switch/ {
    proxy_pass http://127.0.0.1:39000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location /channel-badge/ {
    alias /opt/guanghu/_shared/channel-badge/;
    expires 1h;
}
```

详见 `nginx-snippet.conf`.

## ZY-FN 部署约定

每个 `ZY-FN-XXXX/` 子目录必须包含:

```
ZY-FN-XXXX/
├── manifest-fragment.json   本 ZY-FN 在 function-manifest.json 中对应条目的副本
├── ecosystem.config.js      PM2 配置
├── nginx.conf               域名段 server { } 内的 location 片段
├── .env                     由密钥分发器从 _secrets/ 派生
├── public/                  前端静态资源 (含频道徽章引用)
└── src/                     后端代码
```

新 ZY-FN 部署时 (Phase 1 当前手工, Phase 2 由 channel-switcher 自动化):
1. 部署 workflow SCP 到 `/opt/guanghu/ZY-FN-XXXX/`
2. 更新仓库 `function-manifest.json`, 校验通过 (CI 钩子)
3. 同步 manifest 到服务器 `_manifest/function-manifest.json`
4. PM2 启动该 ZY-FN 自带的 ecosystem.config.js
5. (Phase 2) 移动 `_active` 软链 + reload nginx

## 不在本模板内的事

- 业务代码、数据库、对象存储 — 那是各 ZY-FN 自己的
- 域名 / SSL — 由部署 workflow 处理 certbot
- 防火墙 / 端口策略 — 由 ZY-SVR 维护者按需配置 (建议 iptables 默认拒绝)

## 守护

铸渊 · ICE-GL-ZY001 · TCS-0002∞ | SYS-GLW-0001 · 国作登字-2026-A-00037559
