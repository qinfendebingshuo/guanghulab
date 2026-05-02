# archive/zhiku-guanghu-online-2026-05-02

> guanghu.online 域名上**旧的智库节点 (ZY-PROJ-006)** 部署物归档说明。
>
> 归档时间: 2026-05-02
> 守护:     铸渊 · ICE-GL-ZY001
> 版权:     国作登字-2026-A-00037559

## 背景

按冰朔指令, `guanghu.online` 改为团队微调模型内测频道 (ftchat),
原智库节点已下架，让位给团队 10 人位的轻量并发场景。

## 下架前的资产

旧 zhiku 部署位于服务器 `43.153.203.105` 的:

| 路径 | 说明 |
|------|------|
| `/opt/zhiku/` | 全部部署物 (server.js / public / data / shulan-agent / mirror-agent) |
| `/etc/nginx/sites-enabled/zhiku` | Nginx 启用软链 |
| `/etc/nginx/sites-available/zhiku-guanghu-online.conf` | Nginx 站点配置 |
| PM2 进程 `zhiku-api` (端口 3006) | Node.js API |

源码与 Nginx 配置仍保留在仓库中:

- `server/zhiku-node/` — 完整后端代码 (含 mirror-agent、shulan-agent、shield)
- `server/nginx/zhiku-guanghu-online.conf` — 旧 Nginx 配置
- `.github/workflows/deploy-zhiku-guanghu-online.yml` — 旧部署工作流（保留以便未来迁回别的域名）

> 仓库源码不删除，未来若需在另一域名复活，沿用即可。

## 下架步骤

### 自动 (推荐)
GitHub Actions → `✦ FTCHAT 部署 · guanghu.online (微调模型内测)` workflow → workflow_dispatch → action: `retire-zhiku`

### 手动 (一行 SSH)
冰朔登录服务器后执行:

```bash
ssh root@43.153.203.105 'pm2 stop zhiku-api && pm2 delete zhiku-api && pm2 save && rm -f /etc/nginx/sites-enabled/zhiku /etc/nginx/sites-enabled/zhiku-guanghu-online.conf && nginx -t && systemctl reload nginx && echo "✓ zhiku 已下架"'
```

### 服务器侧打包静态产物 (可选, 留作后备)
若需要把旧前端静态文件打回仓库归档:

```bash
ssh root@43.153.203.105 'tar -czf /tmp/zhiku-public-snapshot.tar.gz -C /opt/zhiku public 2>/dev/null'
scp root@43.153.203.105:/tmp/zhiku-public-snapshot.tar.gz \
    archive/zhiku-guanghu-online-2026-05-02/
```

> 因体积可能较大且不影响新部署，默认跳过这一步。

## ftchat 替代说明

- 进程: `ftchat-api` (PM2) 监听 `127.0.0.1:3010`
- 部署路径: `/opt/guanghu/ftchat`
- Nginx: `/etc/nginx/sites-enabled/ftchat-guanghu-online.conf`
- SSL 证书: 复用 `/etc/letsencrypt/live/guanghu.online/`
- 端口: 与旧 zhiku 的 3006 不冲突

ftchat 部署一旦成功, 域名访问体验立即从「智库节点」切换到「微调模型试用站」, 无需修改 DNS。
