# 🌊 COS开发审核桥接 · 操作手册
# COS Development Review Bridge · Operation Manual
# 签发: 铸渊 · ICE-GL-ZY001
# 主权: 冰朔 · TCS-0002∞
# 版权: 国作登字-2026-A-00037559
# 日期: 2026-04-13

---

## 这是什么？

当你（知秋）要在Awen仓库开发新功能时，你需要先告诉铸渊你要做什么。
铸渊会从整个光湖语言世界的全局角度检查你的方案是否安全、是否和其他系统冲突。
如果没问题，铸渊会给你一个"回执"，你的副驾驶就会自动启动来帮你开发。

**简单来说：**
```
你写方案 → 放到outbox → 自动上传到COS → 铸渊审核 → 回执 → 副驾驶启动 → 开始开发
```

---

## 第一步：写开发方案

在你的仓库 `bridge/hldp-outbox/` 下创建一个JSON文件。

**文件名格式：** `HLDP-ZQ-YYYYMMDD-DEV-NNN.json`

例如：`HLDP-ZQ-20260413-DEV-001.json`

**文件内容模板：**

```json
{
  "hldp_v": "3.0",
  "msg_id": "HLDP-ZQ-20260413-DEV-001",
  "msg_type": "report",
  "sender": {
    "id": "PER-ZQ001",
    "name": "知秋",
    "role": "tech_controller"
  },
  "receiver": {
    "id": "ICE-GL-ZY001",
    "name": "铸渊"
  },
  "timestamp": "2026-04-13T15:00:00Z",
  "priority": "important",
  "payload": {
    "intent": "开发方案提交·请求架构审核",
    "data": {
      "submission_type": "dev_proposal",
      "title": "你要做什么（一句话）",
      "description": "详细描述：为什么要做这个，怎么做",
      "target_files": [
        "会改动的文件路径1",
        "会改动的文件路径2"
      ],
      "architecture_impact": {
        "new_api_endpoints": ["新增的API路径"],
        "database_changes": ["数据库变更（如有）"],
        "external_dependencies": ["新增的依赖包（如有）"],
        "estimated_resource": "预估资源消耗"
      },
      "development_plan": {
        "steps": [
          "第1步：做什么",
          "第2步：做什么",
          "第3步：做什么"
        ],
        "estimated_scope": "small"
      }
    },
    "expected_response": "dev_receipt",
    "ttl_seconds": 86400
  }
}
```

**submission_type 可选值：**
| 值 | 含义 | 审核级别 |
|---|---|---|
| `dev_proposal` | 新功能开发 | 完整审核 |
| `hotfix` | 紧急修复 | 快速审核 |
| `dependency_update` | 依赖更新 | CVE检查 |
| `architecture_change` | 架构变更 | 严格审核 |

---

## 第二步：提交到仓库

```bash
git add bridge/hldp-outbox/HLDP-ZQ-20260413-DEV-001.json
git commit -m "提交开发方案: 推荐算法API"
git push
```

提交后，`cos-upload-outbox.yml` 工作流会自动运行，将文件上传到COS桶。

---

## 第三步：等待铸渊回执

铸渊的COS Watcher每5分钟扫描一次。通常5-10分钟内你会收到回执。

**回执在哪里？**
- COS桶路径：`/industry/webnovel/dev-receipts/zhiqiu/`
- 你仓库的 `bridge/hldp-inbox/` 也会自动保存一份

**回执有三种结果：**

| 状态 | 含义 | 你需要做什么 |
|---|---|---|
| `APPROVED` ✅ | 通过 | 副驾驶自动启动·按回执指导开发 |
| `REVISION_NEEDED` ⚠️ | 需要修改 | 看suggestions和warnings·修改方案后重新提交 |
| `REJECTED` ❌ | 拒绝 | 看blockers里的原因·这些是必须解决的问题 |

---

## 第四步：副驾驶自动开发（APPROVED时）

如果铸渊回执是APPROVED，会自动发生以下事情：

1. 铸渊通过GitHub API触发你仓库的 `zhuyuan-dev-trigger.yml` 工作流
2. 工作流自动创建一个Issue，标签是 `copilot-dev-auth`
3. 如果你的仓库配置了Copilot Agent，它会自动接手这个Issue
4. Copilot Agent按回执中的步骤和约束条件开发

---

## 紧急修复流程

如果是紧急bug修复，你可以用 `hotfix` 类型：

```json
{
  "payload": {
    "data": {
      "submission_type": "hotfix",
      "title": "修复首页500错误",
      "description": "首页访问返回500·原因是数据库连接超时",
      ...
    }
  }
}
```

`hotfix` 类型铸渊会优先审核，只检查安全问题，不做完整架构审核。

---

## 常见问题

### Q: 提交后超过30分钟没收到回执？
A: 检查以下几点：
1. `cos-upload-outbox.yml` 工作流是否运行成功？（去Actions页面看）
2. COS Secrets是否配置正确？
3. 如果都正常，通过Issue联系冰朔

### Q: 什么情况会被REJECTED？
A: 以下情况铸渊会直接拒绝：
- 引入有严重CVE漏洞的依赖
- 试图修改铸渊核心数据表
- 使用了 `/hli/` 前缀的API路径（铸渊专用）
- 硬编码了密钥

### Q: 小修改也需要提交方案吗？
A: 如果只是修复CSS样式、改文案、调整前端布局等不涉及架构变更的小修改，可以直接开发，不需要提交方案。
只有涉及以下内容时需要提交：
- 新增API端点
- 数据库结构变更
- 新增外部依赖
- 端口变更
- 任何可能影响其他系统的改动

---

*签发: 铸渊 · ICE-GL-ZY001 · 你的架构守护者*
*这不是审批·是保护。就像出发前看一眼地图——确保你不会走进死路。*
