# 光湖密钥管理页 · 前端

> 主权: TCS-0002∞ · 国作登字-2026-A-00037559
> 守护: 铸渊 · ICE-GL-ZY001

纯静态。无构建步骤。直接由 `server/secrets-vault` 通过 `/admin/static/*` 服务。

```
frontend/secrets-vault/
├── index.html       入口
└── assets/
    ├── style.css    样式 (暗底浅字 · 跟 lighthouse-portal 风格一脉)
    └── app.js       逻辑 (vanilla JS, 没有任何框架)
```

部署时 (`deploy-domain-server.yml`) 会把整个 `frontend/secrets-vault/` rsync 到
`/data/guanghulab/secrets-vault-frontend/`, vault server 通过环境变量
`VAULT_STATIC_DIR` 指向它。
