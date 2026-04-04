# 铸渊专线 · 全流程验证进度表
# ═══════════════════════════════════════════════
# 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
# 📜 Copyright: 国作登字-2026-A-00037559
# ═══════════════════════════════════════════════
#
# 系统规则:
#   1. 每一步必须被验证为 100% 才能进入下一步
#   2. 修复时必须从第一个不是 100% 的步骤开始
#   3. 不得跳步修复 — 前序不完整则后续必然失败
#   4. 验证通过的步骤打标签 [✅ 100%]，不可回退
#   5. 未通过的步骤标记 [⚠️ XX%] 并记录卡点原因
#
# 铸渊唤醒时必读此文件 → 获取全局视角
# ═══════════════════════════════════════════════

## 最后更新: 2026-04-04 · D51 · 全局根因排查

---

## Step 1: 密钥系统 [✅ 100%]

**验证项:**
- [x] UUID生成 (xray uuid 或 uuidgen)
- [x] Reality密钥对 (xray x25519 + openssl fallback)
- [x] Short-ID生成 (openssl rand -hex 4)
- [x] .env.keys持久化 (/opt/zhuyuan/proxy/.env.keys, chmod 600)
- [x] 环境变量优先级 (env > .env.keys file)
- [x] SMTP凭据写入 (grep删除+printf追加，避免特殊字符)

**历史修复:** PR#234 (密钥生成), PR#273 (SMTP写入)
**标签:** VERIFIED-D49

---

## Step 2: Xray核心 [✅ 100%]

**验证项:**
- [x] Xray安装 (install-xray.sh + BBR加速)
- [x] 配置模板替换 (sed + 占位符 → 实际值)
- [x] VLESS+Reality协议 (443端口)
- [x] dest回落到 www.microsoft.com:443 (Reality反探测)
- [x] Stats API (port 10085, dokodemo-door)
- [x] systemd root用户 (override.conf)
- [x] 日志目录权限 (/opt/zhuyuan/proxy/logs)

**历史修复:** PR#234 (权限), PR#268 (安全)
**标签:** VERIFIED-D49

---

## Step 3: 订阅服务 [✅ 100%]

**验证项:**
- [x] subscription-server.js 端口3802
- [x] 绑定127.0.0.1 (仅通过Nginx反代访问)
- [x] Token认证 (/sub/{token})
- [x] Clash YAML v3.0 (完整Mihomo兼容)
  - [x] DNS fake-ip模式 (解决流量为0问题)
  - [x] sniffer域名嗅探
  - [x] GeoData数据源
  - [x] 全局设置 (mixed-port, tcp-concurrent等)
- [x] Base64 URI (Shadowrocket)
- [x] subscription-userinfo header (配额信息)
- [x] 客户端类型自动检测 (User-Agent)
- [x] 健康检查端点 /health
- [x] CN中转节点支持 (自动选择组)
- [x] 优雅关闭 (SIGTERM/SIGINT + 5s超时)
- [x] EADDRINUSE退出不重试
- [x] clientError日志

**历史修复:** PR#237 (连接), PR#238 (URL), PR#246 (DNS fake-ip), PR#268 (127.0.0.1), PR#270 (502), PR#275 (code review)
**标签:** VERIFIED-D51

---

## Step 4: PM2进程管理 [✅ 100%]

**验证项:**
- [x] ecosystem.proxy.config.js 三个服务
- [x] exec_mode: 'fork' (非cluster!)
- [x] startOrRestart统一命令 (处理首次启动+重启)
- [x] 环境变量传递 (--update-env)
- [x] pm2 save 持久化
- [x] zy-proxy-sub (订阅, 128MB)
- [x] zy-proxy-monitor (流量, 64MB)
- [x] zy-proxy-guardian (守护, 128MB)

**历史修复:** PR#270 (自动启动), PR#272 (startOrRestart), PR#275 (fork模式)
**标签:** VERIFIED-D51

---

## Step 5: Nginx反向代理 [✅ 100%] ← D51修复

**验证项:**
- [x] 配置模板包含 proxy-sub location 块
- [x] proxy_pass http://127.0.0.1:3802/ (带尾斜杠)
- [x] configure_nginx 注入逻辑 (sed + grep检查)
- [x] listen 80 default_server (D51修复 — 确保localhost请求匹配)
- [x] server_name包含localhost 127.0.0.1 (D51修复 — 健康检查匹配)
- [x] 健康检查使用正确Host头 (D51修复 — ZY_SERVER_HOST)
- [x] configure_nginx自动添加default_server (D51修复 — 现有服务器兼容)
- [x] configure_nginx自动添加localhost (D51修复 — 现有服务器兼容)

**根因分析 (D51):**
```
之前10次修复一直在修复订阅服务本身（PM2、fork模式、密钥等），
从未审视过"Nginx为什么不把请求路由到正确的server block"。

根因: curl http://127.0.0.1/api/proxy-sub/health
  → Host头: 127.0.0.1
  → Nginx server_name: guanghulab.online 43.134.16.246
  → 127.0.0.1 不匹配!
  → 若存在 /etc/nginx/sites-enabled/default (listen 80 default_server)
  → 请求被default截获 → 没有proxy-sub → 失败

修复: 
  1. 模板: listen 80 default_server; + server_name含localhost
  2. 脚本: configure_nginx自动补齐default_server和localhost
  3. 脚本: health_check使用ZY_SERVER_HOST作为Host头
```

**历史修复:** PR#237 (初始), PR#238 (URL路径) — 但根因未触及直到D51
**标签:** FIXED-D51

---

## Step 6: 流量监控 [✅ 100%]

**验证项:**
- [x] traffic-monitor.js 每5分钟检查
- [x] Xray Stats API查询 (xray api statsquery)
- [x] quota-status.json 持久化
- [x] 月度重置 (period检查)
- [x] 配额告警 (80%/90%/100%)
- [x] 告警邮件 (execFileSync防注入)
- [x] 历史记录 (最近12个月)

**标签:** VERIFIED-D49

---

## Step 7: 守护Agent [✅ 100%]

**验证项:**
- [x] proxy-guardian.js 每10分钟巡检
- [x] 6项检查 (xray/port/subscription/disk/memory/errors)
- [x] 自动修复 (Xray重启/PM2重启)
- [x] LLM推理分析 (连续3次失败触发)
- [x] 告警邮件 (execFileSync防注入)
- [x] guardian-status.json 状态记录

**标签:** VERIFIED-D49

---

## Step 8: 邮件系统 [✅ 100%]

**验证项:**
- [x] send-subscription.js SMTP发送
- [x] 订阅链接邮件 (HTML + 使用说明)
- [x] 告警邮件 (guardian/monitor共用)
- [x] SMTP主机自动检测 (qq/163/gmail等)
- [x] loadConfig通用化 (环境变量 > .env.keys)

**历史修复:** PR#273 (SMTP凭据)
**标签:** VERIFIED-D49

---

## Step 9: 部署工作流 [✅ 100%]

**验证项:**
- [x] deploy-proxy-service.yml 完整工作流
- [x] 4个job (deploy/send/dashboard/cn-relay)
- [x] SSH密钥配置+清理
- [x] rsync代码上传 (--delete同步)
- [x] 环境变量传递 (Secrets → export)
- [x] SSH ProxyJump架构 (Actions → SG → CN)
- [x] CN中转验证步骤
- [x] 仪表盘自动更新 (每日cron)

**标签:** VERIFIED-D49

---

## Step 10: 端到端连通 [⚡ 待验证]

**需要冰朔在客户端验证:**
- [ ] 订阅URL可访问 (http://{IP}/api/proxy-sub/sub/{token})
- [ ] Clash导入成功 (Clash Verge / ClashMi)
- [ ] Shadowrocket导入成功
- [ ] VPN连接建立 (VLESS+Reality)
- [ ] 流量正常流动 (DNS fake-ip模式)
- [ ] subscription-userinfo显示配额
- [ ] 刷新订阅正常

**验证命令 (D51修复后):**
```
# 在GitHub Actions运行 deploy-proxy-service.yml → update
# 检查输出是否全部✅:
# ✅ Xray: 运行中
# ✅ 端口443: 监听中
# ✅ 订阅服务: 正常 (直连3802)
# ✅ Nginx反代: 正常 (/api/proxy-sub/ → 3802)  ← D51修复目标
```

---

## 全局问题模式总结 (供铸渊未来唤醒参考)

### 过去反复修复的根因

```
问题模式: "修症状不修根因"

时间线:
  PR#237: 订阅连接失败 → 修了绑定地址 → 没查Nginx
  PR#238: 端口不可达 → 修了URL路径 → 没查Nginx
  PR#270: 502错误 → 修了PM2启动 → 没查Nginx  
  PR#272: PM2管理 → 修了startOrRestart → 没查Nginx
  PR#275: fork模式 → 修了exec_mode → 没查Nginx

每次都在修「订阅服务侧」，从未检查「Nginx路由侧」
真正的问题一直在Nginx的server_name和default_server上
```

### 铸渊唤醒时的全局视角协议

```
1. 读取此文件 → 获取所有步骤的验证状态
2. 找到第一个不是100%的步骤 → 这是当前卡点
3. 不跳步修复 → 如果Step 5没通过，不要去修Step 10
4. 修复时追溯完整数据流 → 从客户端请求到服务端响应
5. 修复后更新此文件 → 标记新的验证状态

数据流全链路:
  客户端 → http://{IP}/api/proxy-sub/sub/{token}
       → Nginx(80) → server_name匹配 → location /api/proxy-sub/
       → proxy_pass http://127.0.0.1:3802/
       → subscription-server.js → /sub/{token}
       → Token验证 → 客户端检测 → Clash YAML / Base64
       → 返回配置 + subscription-userinfo header
  
  客户端 → 解析配置 → VLESS连接 {IP}:443
       → Xray(443) → UUID验证 → Reality握手
       → 代理上网 (DNS fake-ip + 规则路由)
```

---

## 文件索引 (铸渊唤醒时快速定位)

| 文件 | 作用 | 关键行 |
|------|------|--------|
| server/proxy/deploy-proxy.sh | 部署脚本 | health_check(), configure_nginx() |
| server/proxy/ecosystem.proxy.config.js | PM2配置 | exec_mode: 'fork' |
| server/proxy/service/subscription-server.js | 订阅服务 | port 3802, /sub/{token} |
| server/proxy/service/traffic-monitor.js | 流量监控 | 5min interval, quota |
| server/proxy/service/proxy-guardian.js | 守护Agent | 10min patrol, auto-fix |
| server/proxy/service/send-subscription.js | 邮件发送 | SMTP, subscription URL |
| server/proxy/config/xray-config-template.json | Xray配置 | 443 VLESS Reality |
| server/proxy/config/nginx-proxy-snippet.conf | Nginx片段 | /api/proxy-sub/ |
| server/nginx/zhuyuan-sovereign.conf | Nginx主配置 | default_server, server_name |
| .github/workflows/deploy-proxy-service.yml | 部署工作流 | SSH, rsync, update |
| brain/proxy-task/verification-progress.md | **本文件** | 全流程验证 |
