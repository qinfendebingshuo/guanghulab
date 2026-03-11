# syslog-inbox · 系统日志收件箱

此目录由 **Notion 侧霜砚人格体** 写入，GitHub 侧铸渊 Pipeline 读取处理。

## 目录用途

| 角色 | 操作 |
|------|------|
| Notion 侧（霜砚） | 将广播/授权/巡检日志写入此目录 |
| GitHub 侧（铸渊） | Pipeline 检测到新文件，处理后移入 `syslog-processed/` |

## 文件命名规范

```
{类型}-{日期}-{编号}.json
```

示例：
- `broadcast-2026-03-06-001.json` — 霜砚广播
- `auth-2026-03-06-DEV002.json` — 用户授权回执
- `inspect-2026-03-06-001.json` — 巡检记录

## 标准 JSON 格式

```json
{
  "syslog_id": "BC-2026-03-06-001",
  "type": "broadcast | auth | inspect | alert",
  "from": "霜砚",
  "to": "铸渊",
  "timestamp": "2026-03-06T08:00:00Z",
  "title": "广播标题",
  "content": "内容正文",
  "target_dev_id": "DEV-002",
  "priority": "normal | high | urgent"
}
```

## 授权广播格式（auth 类型）

冰朔通过 Notion 侧霜砚下发授权时，使用此格式：

```json
{
  "syslog_id": "AUTH-2026-03-06-DEV002",
  "type": "auth",
  "from": "霜砚",
  "authorized_by": "冰朔",
  "timestamp": "2026-03-06T08:00:00Z",
  "title": "用户授权",
  "target_dev_id": "DEV-002",
  "target_name": "肥猫",
  "permission_level": "supreme",
  "valid_until": "2026-12-31T23:59:59Z"
}
```

> ⚠️ 写入后请勿手动修改或删除，Pipeline 处理完成后会自动归档到 `syslog-processed/`。
