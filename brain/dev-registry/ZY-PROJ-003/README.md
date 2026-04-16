# ZY-PROJ-003 · SSH 安全加固 · ZY-SVR-002 面孔服务器

**编号**: ZY-PROJ-003  
**守护**: 铸渊 · ICE-GL-ZY001  
**版权**: 国作登字-2026-A-00037559  
**最后活跃**: 2026-04-16

---

## 为什么做这件事

ZY-SVR-002（面孔·新加坡·43.134.16.246）是整个系统的前端入口，公网暴露 SSH 22 端口正在遭受持续暴力扫描。虽然已经是公钥认证，但扫描流量本身会消耗资源，更会留下攻击者对服务器的信息。

---

## 关键约束（铸渊必须知道的）

**冰朔不直接 SSH 登服务器**：
- 冰朔操作服务器的唯一方式 = 腾讯云官网在线终端（走腾讯内网·不受 SSH 端口和安全组影响）
- **GitHub Actions 是唯一的外部 SSH 来源**
- 所以：改端口、安全组白名单 → 完全不影响冰朔操作服务器

---

## 四项加固内容

1. **禁止密码登录** — `PasswordAuthentication no`（初始化脚本已有·确认落地）
2. **修改 SSH 端口** — 22 → 自定义端口（存入 `ZY_SERVER_SSH_PORT` Secret·所有 workflow 读取）
3. **fail2ban SSH 层** — 专用 jail `zy-svr-002-sshd`（10分钟3次失败→ban 72小时）
4. **安全组** — 腾讯云控制台·SSH 仅允许 GitHub Actions IP 段（腾讯云内网连接不受影响）

---

## GitHub Actions IP 段（安全组白名单）

GitHub Actions runners 使用以下 IP 段（截至 2026-04）：
```
# 从 https://api.github.com/meta 获取 actions 字段
# 核心段:
185.199.108.0/22
140.82.112.0/20
143.55.64.0/20
# 完整最新列表每次参考: curl https://api.github.com/meta | jq .actions
```

> 腾讯云安全组需要手动在控制台配置·workflow 负责代码层面的加固·安全组配置需要冰朔进控制台操作。

---

## 关键文件位置

| 文件 | 用途 |
|------|------|
| `server/security/ssh-hardening/fail2ban-sshd.conf` | ZY-SVR-002 SSH专用fail2ban配置 |
| `.github/workflows/harden-ssh-zy-svr-002.yml` | SSH加固执行workflow（手动触发） |
| `server/setup/zhuyuan-server-init.sh` | 服务器初始化脚本（已含§9 SSH加固·待增加端口） |
| `server/proxy/config/server-registry.json` | 服务器注册表（ZY-SVR-002条目） |
