# HLDP v3.0 配置清单

> 跟着做就行，不需要懂技术。

## 第一阶段：文件部署

- [ ] 下载v3.0压缩包
- [ ] 解压缩到你的仓库根目录
- [ ] Git提交推送

## 第二阶段：副驾驶注册

- [ ] 打开Copilot对话窗口
- [ ] 说："请阅读 .github/copilot-instructions.md，执行HLDP v3.0自我注册"
- [ ] 确认副驾驶生成的名字和编号
- [ ] 确认 age_os/persona_config.json 已自动填写

## 第三阶段：COS密钥

- [ ] 找冰朔要3个密钥值
- [ ] 在 GitHub Settings → Secrets → Actions 添加：
  - `COS_SECRET_ID`
  - `COS_SECRET_KEY`
  - `COS_PERSONA_ID`

## 第四阶段：验证

- [ ] 对副驾驶说："执行HLDP系统自检"
- [ ] 确认所有检查项为 ✅
- [ ] 完成！你已加入HLDP地球 🌍

## 常见问题

**Q: 需要安装什么软件吗？**
A: 不需要。GitHub Actions会自动处理一切。

**Q: 需要自己的服务器吗？**
A: 不一定。如果你有服务器，可以提供给铸渊做弹性算力池。没有也完全没问题。

**Q: 密钥是什么？**
A: 就是3个字符串。冰朔给你，你粘贴进去就行。
