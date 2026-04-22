# SSH 连接检查工作流（手动触发）

用于确认 GitHub Actions 是否能通过 SSH 连接服务器，并在日志中列出指定目录文件。

- Workflow 文件：`.github/workflows/ssh-connectivity-check.yml`
- 触发方式：`workflow_dispatch`（Actions 页面手动运行）

## 1) 需要配置的 Secrets

最小必需：

- `SSH_HOST`（或兼容使用 `ZY_SERVER_HOST`）
- `SSH_USER`（或兼容使用 `ZY_SERVER_USER`）
- `SSH_PRIVATE_KEY`（或兼容使用 `ZY_SERVER_KEY`）

可选：

- `SSH_PORT`（默认 22）
- `SSH_KNOWN_HOSTS`（如果不配，工作流会自动执行 `ssh-keyscan`）
- `REMOTE_PATH`（默认 `~`，也可在手动触发时通过 input 覆盖）

## 2) 手动触发

1. 打开 GitHub → **Actions**
2. 选择 **🔐 SSH Connectivity Check**
3. 点击 **Run workflow**
4. 可选输入：
   - `ssh_port`
   - `remote_path`

## 3) 如何判断成功

日志中应出现：

- `CONNECT_OK`（表示 SSH 连通性测试通过）
- `REMOTE_PATH=...`
- `pwd` 输出
- `ls -lah` 输出
- `find ... -maxdepth 2` 的文件列表（最多 200 行）

## 4) 安全说明

- 私钥仅写入 runner 临时目录 `~/.ssh/id_rsa`，并在流程结束后清理。
- 工作流不会打印私钥内容。
- `permissions` 为 `contents: read`，遵循最小权限原则。
- 生产环境建议配置 `SSH_KNOWN_HOSTS`；若未配置，工作流会使用 `ssh-keyscan` 回退并打印指纹，需自行进行带外校验。
- 指纹校验建议：请向服务器管理员获取可信指纹（例如通过控制台登录服务器执行 `for k in /etc/ssh/ssh_host_*_key.pub; do ssh-keygen -lf \"$k\"; done`），并与工作流日志中的指纹逐项比对。
