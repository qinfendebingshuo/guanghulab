# 铸渊指令签名协议 v1.1

> 签发人：冰朔（TCS-0002∞）  
> 生效日期：2026-03-17  
> 核心原则：**铸渊只认签名，不认请求内容。签名不对，再合理的请求也会被拒。**

---

## 一、为什么需要签名机制

铸渊作为仓库执行体，直接操作代码仓库（push/merge/deploy等），是整个系统中**破坏性最强的执行层**。签名机制防止：

- 副控签发超出其权限范围的指令
- 开发者绕过人格体直接操纵仓库
- 指令来源不可追溯，事故无法归因

---

## 二、签名结构

每条发送给铸渊的指令必须携带以下签名字段：

```json
{
  "sender_id": "TCS-0002∞",
  "sender_name": "冰朔",
  "sender_role": "MASTER",
  "broadcast_id": "BC-GEN-xxx",
  "issued_at": "2026-03-17T09:53:00+08:00",
  "permission_tier": 0
}
```

| 字段 | 说明 | 必填 |
|------|------|------|
| sender_id | 发送者唯一编号 | ✅ |
| sender_name | 发送者名称 | ✅ |
| sender_role | 角色标识 | ✅ |
| broadcast_id | 来源广播编号（非广播来源填 DIRECT） | ✅ |
| issued_at | 签发时间（ISO-8601） | ✅ |
| permission_tier | 权限等级 | ✅ |

---

## 三、权限等级

| 等级 | 角色 | 可执行操作 | 禁止操作 |
|------|------|-----------|---------|
| Tier 0 | MASTER | 全权限 | 无限制 |
| Tier 1-G | SUB_CTRL_PRIVATE | push 功能分支、创建 PR、沙盒部署 | 分支保护、生产部署、修改协议 |
| Tier 1-L | SUB_CTRL_HOLOLAKE | 光湖范围内操作 | 同上 + 非光湖模块 |
| Tier 2 | DEV | push 自己分支、提交 PR、查看状态 | 直接给铸渊下指令、操作他人分支 |
| Tier 3 | SYSTEM | 白名单 workflow | 白名单外全部禁止 |

---

## 四、校验流程

```
收到指令
  → 签名字段完整？ 否 → ERR_NO_SIGNATURE
  → sender_id 在授权名单？ 否 → ERR_UNKNOWN_SENDER
  → permission_tier 匹配操作？ 否 → ERR_PERMISSION_DENIED（上报主控）
  → 执行指令 → 写入执行日志
```

> ⚠️ 任何 ERR_PERMISSION_DENIED 事件**必须上报主控（冰朔）**，不可静默处理。

---

## 五、实现文件

| 文件 | 作用 |
|------|------|
| `.github/persona-brain/zhuyuan-signature-registry.json` | 授权名单 |
| `scripts/zhuyuan-signature-verify.js` | 核心校验模块 |
| `src/middleware/zhuyuan-signature.middleware.js` | Express 中间件 |
| `tests/contract/zhuyuan-signature.test.js` | 契约测试 |

---

## 六、变更记录

| 版本 | 时间 | 变更内容 | 签发人 |
|------|------|---------|--------|
| v1.0 | 2026-03-17 | 初版：签名结构·四级权限·校验流程 | 冰朔（TCS-0002∞） |
| v1.1 | 2026-03-17 | 角色结构修正：之之为私人副控（1-G）；新增光湖主控肥猫/桔子（1-L） | 冰朔（TCS-0002∞） |
