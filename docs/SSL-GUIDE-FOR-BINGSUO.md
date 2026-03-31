# 🔒 SSL证书配置指南 · 冰朔专用

> **写给冰朔的话**: 这是铸渊在第十六次对话中为你写的SSL证书配置指南。你只需要按照下面的步骤操作，不需要理解任何技术细节。铸渊已经把所有自动化脚本都准备好了。

---

## 📌 你需要知道的

| 问题 | 答案 |
|------|------|
| SSL证书是什么？ | 让网站从 `http://` 变成 `https://` 的安全锁，浏览器地址栏会显示🔒 |
| 需要花钱吗？ | **不需要**。铸渊使用 Let's Encrypt 免费证书 |
| 证书会过期吗？ | 证书90天有效，但铸渊已配置**自动续期**，你不需要管 |
| 我需要做什么？ | 按下面的步骤点几下就好，**一共只需要5分钟** |

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
   - **SSL域名**: 输入 **`guanghu.online`**（这是测试站域名）
3. 点击绿色的 **「Run workflow」** 按钮

### 第③步：等待完成

1. 页面会出现一个新的工作流运行（黄色圆圈 = 运行中）
2. 等待它变成 **绿色✅**（大约1-3分钟）
3. 完成！你的测试站 `guanghu.online` 现在已经是 HTTPS 了

---

## ✅ 验证是否成功

打开浏览器，访问：
```
https://guanghu.online
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
2. 输入你的域名（如 `guanghu.online`）
3. 查看它指向的IP是否是 `43.134.16.246`（新加坡服务器）

如果IP不对，需要去域名提供商的管理面板修改DNS解析。

### Q: 证书会自动续期吗？

会的。铸渊已经配置了自动续期。证书每90天过期，但系统会在过期前30天自动续期。你不需要做任何事。

### Q: 两个域名可以同时配SSL吗？

可以。先配一个，成功后再运行一次配另一个。

### Q: 还需要配置 ZY_SSL_FULLCHAIN 和 ZY_SSL_PRIVKEY 密钥吗？

**不需要了**。因为铸渊使用了Let's Encrypt（免费SSL证书服务），证书直接在服务器上自动获取和管理，不需要在GitHub Secrets里存放证书内容。

如果将来有特殊需求需要自定义证书，铸渊会另外通知你。

---

## 📋 技术细节（铸渊的备忘）

> 以下内容是给铸渊自己看的，冰朔可以忽略。

- **证书管理**: certbot + Let's Encrypt (ACME协议)
- **验证方式**: HTTP-01 challenge (通过Nginx)
- **证书路径**: `/etc/letsencrypt/live/{domain}/`
- **Nginx SSL配置**: `/opt/zhuyuan/config/nginx/ssl-{domain}.conf`
- **自动续期**: systemd timer `certbot.timer`
- **续期hook**: `/etc/letsencrypt/renewal-hooks/post/reload-nginx.sh`
- **日志**: `/opt/zhuyuan/data/logs/ssl-setup.log`
- **脚本**: `server/setup/setup-ssl.sh`
- **工作流**: `deploy-to-zhuyuan-server.yml` → action: `setup-ssl`

---

*📝 由铸渊(ICE-GL-ZY001)在第十六次对话中为冰朔编写 · 2026-03-31*
*国作登字-2026-A-00037559*
