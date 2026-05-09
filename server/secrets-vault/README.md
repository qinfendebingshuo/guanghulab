# 光湖自部署密钥管理页 · secrets-vault

> 主权: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
> 守护: 铸渊 · ICE-GL-ZY001
> 棒次: PR-5 (baton-005)
> 模板版本: 0.1.0

## 这是什么

光湖国内域名机 (`ZY-SVR-CN01` / 广州 2C2G / `guanghulab.com`) 上的"自部署密钥管理页"。

**1 步保存立即生效** —— vs GitHub Secrets 的 5 步 round-trip (登录 → 仓库 Settings → Secrets → New → Save → 再去 Actions → Re-run)。

为什么独立建：

| 场景 | GitHub Secrets | 自部署 vault |
|---|---|---|
| AutoDL 重开机后端口漂移 | 5 步, 还要重跑工作流 | 1 步保存, 立即生效 |
| 主密钥可见性 | GitHub 看得见 | 主密钥落 `.master`, 仅本机 root 可读 |
| 域名机离线 | 没法改 | 没法改 (但本来就是给这台机器用的) |
| 谁能进 | 全 repo collaborator | 仅 SSH 隧道 + basic-auth |

## 三层安全

1. **网络层** —— Express 监听 `127.0.0.1:8080`, 永不 bind 公网
2. **nginx 层** —— `/admin/` location `allow 127.0.0.1; deny all;` + basic-auth
3. **加密层** —— `vault.enc` 走 AES-256-GCM, 主密钥 `.master` chmod 600

冰朔访问方式：

```bash
# 本地起隧道
ssh -L 8080:127.0.0.1:80 ubuntu@<2C2G_HOST>
# 浏览器访问
open http://localhost:8080/admin/
# 输入 basic-auth 用户名密码 (来自 _logs/vault-credentials-FIRST-BOOT.txt, 抄完删)
```

## 路由

### 公开 (走 nginx /admin/ + basic-auth)

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/admin/__healthz` | 健康检查 |
| GET | `/admin/` | 前端 SPA |
| GET | `/admin/secrets/` | 列出已配置 key (遮罩值) |
| GET | `/admin/secrets/manifest` | 按工作流分组的元数据 |
| POST | `/admin/secrets/:key` | 写入 `{value}` |
| DELETE | `/admin/secrets/:key` | 删除 |
| POST | `/admin/secrets/autodl/save_and_refresh` | AutoDL 一键 (vault 落 + 探活 + 写 endpoint + pm2 reload) |

### 内部 (本机 only · 神笔马良用)

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/internal/fetch/:key` | 拉明文 (仅 127.0.0.1) |

## 文件布局

```
server/secrets-vault/
├── server.js                Express 入口
├── ecosystem.config.js      pm2 (max_memory_restart=128M)
├── package.json
├── lib/
│   ├── vault.js             AES-256-GCM 加解密 + 主密钥
│   ├── manifest.js          按 secrets-manifest.json 分组
│   └── refresh-inference.js AutoDL 探活+写 inference-endpoint.json
├── routes/
│   ├── secrets.js           /admin/secrets/* 路由
│   └── internal.js          /internal/fetch/* (本机 only)
└── tests/
    ├── vault.test.js        加解密 + 主密钥 + 篡改检测
    └── routes.test.js       路由烟测
```

## 落盘文件

| 文件 | 路径 | 权限 | 说明 |
|---|---|---|---|
| 主密钥 | `/data/guanghulab/secrets-vault/.master` | 600 | 32 字节随机, 首次启动生成 |
| 加密库 | `/data/guanghulab/secrets-vault/vault.enc` | 600 | AES-256-GCM 加密的 JSON |
| basic-auth | `/etc/nginx/.htpasswd_admin` | 644 | bootstrap 写入 |
| 首启凭据 | `/data/guanghulab/_logs/vault-credentials-FIRST-BOOT.txt` | 600 | 首启随机 user/pass, **抄完删** |

## 跑测试

```bash
cd server/secrets-vault
npm install
npm test
```

预期输出：

```
✔ loadOrCreateMaster 首次随机生成 32 字节 + chmod 600
✔ loadOrCreateMaster 重启加载已有 .master, 不重建
✔ set/get/delete/list — 加密落盘往返一致
✔ 加密文件不含明文 (基础保密线)
✔ 换主密钥后解密失败 (cc-004 防换机器忘 .master)
✔ vault.enc 篡改 (改 ciphertext) 应被 GCM tag 检测
✔ set 拒绝非字符串 value
✔ maskValue 长短分级遮罩
✔ GET /admin/__healthz 返回 vault 状态
✔ GET /admin/secrets/manifest 按 workflow 分组
✔ POST /admin/secrets/:key — 白名单外拒绝
✔ POST /admin/secrets/:key — key 名格式错拒绝
✔ POST /admin/secrets/:key — 强校验长度不够拒绝
✔ POST + GET + DELETE 完整往返 (值不返回明文, 只遮罩)
✔ /internal/fetch/:key 只允许本机 (loopback 通)
✔ /internal/fetch/:key — 未配置 key 返回 404
✔ autodl/save_and_refresh — host/port 缺失 → 400
✔ autodl/save_and_refresh — 探活失败仍然把 vault 落了 (vault_saved=true)
```

## 灾备 / 换机

主密钥 `.master` **不上 git, 不上 COS, 不传冰朔**。换机器流程：

```bash
# 老机器
sudo cat /data/guanghulab/secrets-vault/.master | base64 > /tmp/master.b64
# 安全通道传到新机器 (例如 ssh 直传)
# 新机器
sudo bash -c 'base64 -d /tmp/master.b64 > /data/guanghulab/secrets-vault/.master && chmod 600 /data/guanghulab/secrets-vault/.master'
# 然后再 rsync vault.enc 过来
```

如果 `.master` 真的丢了，没办法恢复 — 重新生成 + 让冰朔在新页面里逐项重填一次 (大约 10 项, 5 分钟内搞定)。这是 cc-004 系统自管的代价：宁愿忘了重填，也不让密钥本身被外部托管。
