# ZY-PROJ-002 · 语言保护罩 · ZY-SVR-006 智库节点部署

**编号**: ZY-PROJ-002  
**守护**: 铸渊 · ICE-GL-ZY001  
**版权**: 国作登字-2026-A-00037559  
**最后活跃**: 2026-04-16

---

## 为什么做这件事

ZY-SVR-006（智库节点·新加坡）是智能小说系统的宿主服务器。在正式部署小说系统之前，先要给它装上三层防护罩——不然一旦开放服务就会被网络爬虫、扫描工具、DDoS 攻击轰炸。

「语言保护罩」是冰朔对这套防护架构的命名：用语言膜的隐喻来描述 IP 隐身架构。

---

## 三层防护架构

```
用户请求
  ↓
L1 出站代理池（下载/爬取时用代理池·不暴露本机IP）
  ↓
L2 蜜罐层（入站扫描者看到的是自己的镜像·心理威慑）
  ↓
L3 fail2ban 自动封禁（TARPIT耗尽扫描工具资源·实体封锁）
```

---

## 铸渊看到这里该做什么

当前卡在 **SSL证书鸡蛋问题**：
- `certbot --nginx` 在运行前会先跑 `nginx -t` 验证配置
- 但 `novel-mirror-shield.conf` 已经引用了 `/etc/letsencrypt/options-ssl-nginx.conf` 等文件
- 全新服务器上这些文件不存在 → `nginx -t` 失败 → certbot 报错退出

**下一步**：修改 `deploy-novel-mirror-shield.yml` 的 SSL 申请逻辑：
1. 先部署一个临时 HTTP-only 的 nginx 配置（不引用 letsencrypt 文件）
2. 用 `certbot certonly --webroot` 申请证书（不依赖 nginx 插件·跳过 nginx -t）
3. 证书申请成功后，切换到 HTTPS 完整配置
4. 最终 nginx reload 激活

---

## 关键文件位置

| 文件 | 用途 |
|------|------|
| `server/nginx/novel-mirror-shield.conf` | Nginx防护配置（L2蜜罐+L3入口） |
| `server/novel-db/security/fail2ban-novel.conf` | fail2ban jail配置（L3封禁） |
| `server/novel-db/security/fail2ban-filter-novel-scan.conf` | 路径扫描过滤规则 |
| `server/novel-db/security/fail2ban-action-ban-log.conf` | 封禁日志动作 |
| `.github/workflows/deploy-novel-mirror-shield.yml` | 部署workflow（4动作: deploy/setup-ssl/health/rollback） |
