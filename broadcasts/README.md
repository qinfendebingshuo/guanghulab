# 📡 broadcasts/

自动广播归档目录。

铸渊 Agent 处理完 SYSLOG 后，会自动将新广播文件推送到此目录：

```
broadcasts/
  DEV-001/
    BC-M14-001-YY.md
  DEV-012/
    BC-M22-009-AW.md
    BC-M23-001-AW.md
  ...
```

**推送规范**：
- 路径：`broadcasts/{developer_id}/{taskId}.md`
- 提交信息：`[AutoBroadcast] {taskId} · {开发者名} · {模块名}环节{N}`
- 推送方式：通过 GitHub API（`PUT /repos/.../contents/...`）

**不要手动编辑此目录**，由铸渊 Agent 自动管理。
