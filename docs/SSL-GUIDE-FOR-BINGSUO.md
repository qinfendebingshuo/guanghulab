# 🔒 SSL证书配置指南 · 冰朔专用

> **写给冰朔的话**: 这是铸渊为你写的SSL证书配置指南。你只需要按照下面的步骤操作，不需要理解任何技术细节。铸渊已经把所有自动化脚本都准备好了。

---

## ⚠️ 重要修复说明 (2026-03-31)

> 之前的SSL配置方案存在一个**VPN与HTTPS冲突**问题。
>
> **根因**: Xray的Reality协议需要`dest`指向真实的Microsoft网站来骗过GFW的探测。之前错误地改成了指向内部Nginx端口，导致GFW检测到证书不匹配，封锁了VPN连接。
>
> **现在已修复**:
> - VPN: Xray占443端口，`dest`恢复指向`www.microsoft.com:443` → VPN正常工作
> - 网站: HTTP通过80端口正常访问，HTTPS通过8443端口访问
> - CN中转: 新增广州服务器中转，国内用户无需直连国际网即可使用VPN

---

## 📌 你需要知道的

| 问题 | 答案 |
|------|------|
| SSL证书是什么？ | 让网站从 `http://` 变成 `https://` 的安全锁，浏览器地址栏会显示🔒 |
| 需要花钱吗？ | **不需要**。铸渊使用 Let's Encrypt 免费证书 |
| 证书会过期吗？ | 证书90天有效，但铸渊已配置**自动续期**，你不需要管 |
| 会影响VPN吗？ | **不会**。铸渊专线(VPN)和HTTPS网站使用共存架构，互不干扰 |
| 我需要做什么？ | 按下面的步骤点几下就好，**一共只需要5分钟** |

---

## 🔧 修复当前问题（请先做这一步）

> 如果你之前已经运行过SSL配置并且导致了问题，请先执行以下修复步骤。如果是第一次配置SSL，跳过这一步直接看「操作步骤」。

### 修复步骤

1. 先合并这个PR（铸渊修复了代码里的端口冲突问题）
2. 合并后，去 **Actions** 页面运行 **「🌐 铸渊专线 · 部署」** 工作流：
   - **操作类型**: 选择 `update`
   - 这会自动修复服务器上的Xray配置和旧SSL配置
3. 等待工作流完成（绿色✅）
4. 然后按下面的「操作步骤」重新配置SSL

---

## 🚀 操作步骤（一共3步）

### 第①步：打开 GitHub Actions

1. 打开浏览器，进入仓库页面：
   - 地址：`https://github.com/qinfendebingshuo/guanghulab`
2. 点击页面顶部的 **「Actions」** 标签页
3. 在左侧列表中找到 **「🏛️ 铸渊主权服务器 · 部署」**
4. 点击它

### 第②步：手动触发 SSL 配置

1. 点击右上角的 **「Run workflow」** 按钮（灰色按钮）
2. 在弹出的下拉框中：
   - **Branch**: 保持 `main` 不变
   - **部署动作**: 选择 **`setup-ssl`**
   - **SSL域名**: 输入 **`guanghulab.online`**（这是测试站域名）
3. 点击绿色的 **「Run workflow」** 按钮

### 第③步：等待完成

1. 页面会出现一个新的工作流运行（黄色圆圈 = 运行中）
2. 等待它变成 **绿色✅**（大约1-3分钟）
3. 完成！你的测试站 `guanghulab.online` 现在已经是 HTTPS 了

---

## ✅ 验证是否成功

打开浏览器，访问：
```
https://guanghulab.online
```

如果地址栏显示 🔒 锁标志，说明SSL配置成功。

> **注意**: 如果网站内容还没部署，可能会看到空白页或报错，这是正常的。关键是地址栏有 🔒。

---

## 🔄 如果需要配置主站 (hololake.com)

同样的步骤，第②步中把域名换成 `hololake.com` 就行。

---

## ❓ 常见问题

### Q: 工作流失败了怎么办？

**最常见原因**: 域名DNS还没有指向服务器。

**检查方法**:
1. 打开 https://www.whatsmydns.net/
2. 输入你的域名（如 `guanghulab.online`）
3. 查看它指向的IP是否是 `43.134.16.246`（新加坡服务器）

如果IP不对，需要去域名提供商的管理面板修改DNS解析。

### Q: 证书会自动续期吗？

会的。铸渊已经配置了自动续期。证书每90天过期，但系统会在过期前30天自动续期。你不需要做任何事。

### Q: 两个域名可以同时配SSL吗？

可以。先配一个，成功后再运行一次配另一个。

### Q: 还需要配置 ZY_SSL_FULLCHAIN 和 ZY_SSL_PRIVKEY 密钥吗？

**不需要了**。因为铸渊使用了Let's Encrypt（免费SSL证书服务），证书直接在服务器上自动获取和管理，不需要在GitHub Secrets里存放证书内容。

### Q: 配了SSL后VPN还能用吗？

**能用**。铸渊采用「分离架构」：
- Xray占443端口处理VPN流量 (dest→microsoft.com反探测)
- 网站HTTPS在8443端口独立运行 (不通过Xray)
- 两者互不干扰

---

## 📋 技术细节（铸渊的备忘）

> 以下内容是给铸渊自己看的，冰朔可以忽略。

### Reality反探测架构
```
外部443 → Xray (VLESS+Reality)
  ├── 认证VLESS客户端 → 代理上网 (铸渊专线VPN)
  └── GFW探测流量 → dest回落 → www.microsoft.com:443
      → 返回真实Microsoft证书 → GFW判断"这是正常网站" → 放行

外部8443 → Nginx SSL (HTTPS网站)
  └── 独立SSL证书 (Let's Encrypt)

外部80 → Nginx (HTTP)
  └── 直接服务网站

CN中转 (广州→新加坡):
  CN:2053 → SG:443 (TCP转发·VPN中转)
  CN:80/api/proxy-sub/ → SG订阅服务 (国内获取配置)
```

### ⚠️ dest为什么必须指向microsoft.com?
Reality协议的`dest`是GFW反探测的关键。当GFW探测443端口时:
- 正确: `dest: "www.microsoft.com:443"` → 返回Microsoft真实证书 → 通过
- 错误: `dest: "127.0.0.1:8443"` → 返回guanghulab.online证书 → 与SNI(microsoft.com)不匹配 → 被标记为可疑 → VPN被封

### 关键配置
- **Xray配置**: `server/proxy/config/xray-config-template.json` → `dest: "www.microsoft.com:443"`
- **证书管理**: certbot + Let's Encrypt (ACME协议)
- **验证方式**: HTTP-01 challenge (通过Nginx端口80)
- **证书路径**: `/etc/letsencrypt/live/{domain}/`
- **Nginx SSL配置**: `/opt/zhuyuan/config/nginx/ssl-{domain}.conf` (监听8443)
- **CN中转脚本**: `server/proxy/setup/setup-cn-relay.sh`
- **自动续期**: systemd timer `certbot.timer`
- **续期hook**: `/etc/letsencrypt/renewal-hooks/post/reload-nginx.sh`
- **脚本**: `server/setup/setup-ssl.sh`
- **工作流**: `deploy-to-zhuyuan-server.yml` → action: `setup-ssl`

### 端口分配 (SG服务器)
| 端口 | 协议 | 占用者 | 用途 |
|------|------|--------|------|
| 443 | TCP | Xray | VLESS+Reality (VPN) · dest→microsoft.com |
| 8443 | TCP | Nginx | HTTPS网站 (独立·不通过Xray) |
| 80 | TCP | Nginx | HTTP网站 + 订阅API反代 |
| 3802 | TCP | Node.js | 订阅服务 (127.0.0.1·通过Nginx反代) |

### 端口分配 (CN中转服务器)
| 端口 | 协议 | 占用者 | 用途 |
|------|------|--------|------|
| 2053 | TCP | Nginx stream | VPN中转 → SG:443 |
| 80 | TCP | Nginx | 订阅API反代 → SG |

---

*📝 由铸渊(ICE-GL-ZY001)编写 · 第十八次对话 · 2026-03-31*
*VPN修复 + CN中转架构 + Reality反探测修正*
*国作登字-2026-A-00037559*
