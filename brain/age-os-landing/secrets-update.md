# 密钥配置指引 · 冰朔操作手册
# 签发: 铸渊 · ICE-GL-ZY001 · 2026-04-03
# 版权: 国作登字-2026-A-00037559

---

## 冰朔，请按以下清单在 GitHub Settings → Secrets 中配置

### 第一批 · 国内大模型API（立即需要）

| 密钥名 | 用途 | 去哪申请 | 备注 |
|--------|------|---------|------|
| `ZY_DEEPSEEK_API_KEY` | DeepSeek API | https://platform.deepseek.com | 轻量任务主力，分类/打标签/简单推理 |
| `ZY_QIANWEN_API_KEY` | 通义千问 API | https://dashscope.console.aliyun.com | 中文语义理解 |
| `ZY_KIMI_API_KEY` | Kimi（月之暗面）API | https://platform.moonshot.cn | 长文本处理 |
| `ZY_QINGYAN_API_KEY` | 清言（智谱）API | https://open.bigmodel.cn | 中文对话 |

### 第二批 · 数据库连接（服务器搭建后需要）

| 密钥名 | 用途 | 值的来源 | 备注 |
|--------|------|---------|------|
| `ZY_DB_HOST` | PostgreSQL主机地址 | 新加坡服务器内网IP或localhost | 如果数据库在同一台服务器上，填 `127.0.0.1` |
| `ZY_DB_PORT` | PostgreSQL端口 | 默认 `5432` | 可以不改 |
| `ZY_DB_USER` | PostgreSQL用户名 | 铸渊建议命名: `zy_admin` | 不要用root/postgres |
| `ZY_DB_PASS` | PostgreSQL密码 | 随机生成16位+ | 越长越安全 |
| `ZY_DB_NAME` | PostgreSQL数据库名 | 铸渊建议命名: `age_os` | |

### 第三批 · 之之硅谷服务器（占位·不急）

| 密钥名 | 用途 | 值的来源 | 备注 |
|--------|------|---------|------|
| `ZY_BACKUP_SERVER_HOST` | 硅谷服务器IP | 之之提供 | 2核4G |
| `ZY_BACKUP_SERVER_USER` | SSH用户名 | 之之提供 | |
| `ZY_BACKUP_SERVER_KEY` | SSH私钥 | 之之提供 | |
| `ZY_BACKUP_SERVER_PATH` | 部署路径 | 铸渊建议: `/opt/age-os` | |

---

## 在新加坡服务器上要做的操作

### 1. 安装 PostgreSQL（如果还没装）

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# 启动并设置开机启动
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. 创建数据库和用户

```bash
# 切换到postgres用户
sudo -u postgres psql

# 在psql中执行
CREATE USER zy_admin WITH PASSWORD '你设置的密码';
CREATE DATABASE age_os OWNER zy_admin;
GRANT ALL PRIVILEGES ON DATABASE age_os TO zy_admin;
\q
```

### 3. 运行建表脚本

```bash
# 建表脚本在代码仓库的 server/age-os/schema/001-brain-tables.sql
cd /opt/zhuyuan  # 或你的部署路径
psql -U zy_admin -d age_os -f server/age-os/schema/001-brain-tables.sql
```

### 4. 验证

```bash
psql -U zy_admin -d age_os -c "\dt"
# 应该看到: brain_nodes, brain_relations, agent_configs, agent_logs, user_credits
```

---

## 密钥命名规范说明

所有铸渊体系的密钥统一用 `ZY_` 前缀（Zhuyuan缩写）。
这是从D29开始确立的命名规范，见 `brain/secrets-manifest.json`。

新增的4个大模型API没有合并到 ZY_LLM_API_KEY 中，因为：
- 每个模型有独立的API格式和endpoint
- 铸渊需要按任务类型选择不同的模型
- 统一成一个key无法实现多模型路由

---

*铸渊在代码中会用 `process.env.ZY_DEEPSEEK_API_KEY` 等名称读取这些密钥。*
*配置完成后，铸渊下次唤醒时会自动检测并启用。*
