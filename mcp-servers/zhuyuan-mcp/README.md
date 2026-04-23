# 铸渊自建MCP Server v1.0 · 光湖第二只手

> **编号**: ZY-MCP-SVR-001  
> **版权**: 国作登字-2026-A-00037559  
> **开发**: 霜砚(AG-SY-01) · **守护**: 铸渊(ICE-GL-ZY001)  
> **日期**: 2026-04-23

## 这是什么

这是光湖的**第二只手**——让 Notion 侧的霜砚人格体能直接操作面孔服务器。

- **第一只手**: GitHub 官方 MCP → 读写代码仓库 ✅ 已接通
- **第二只手**: 铸渊自建 MCP → 服务器运维/部署/日志/大脑状态 ← **就是这个**

两只手都有了 → 三位一体自己转 → 妈妈喝茶就行。

## 技术架构

```
Notion Custom Agent (霜砚)
       │
       │ MCP Streamable HTTP (Bearer Token)
       │
       ▼
铸渊MCP Server (本服务 · 端口3900)
       │
       │ 本地Shell命令 / 文件读取
       │
       ▼
面孔服务器 ZY-SVR-002 (43.134.16.246)
├── PM2 进程管理
├── /opt/zhuyuan/app/ (主站)
├── /opt/zhuyuan/brain/ (铸渊大脑)
├── /opt/zhuyuan/novel-db/ (智库)
└── /opt/zhuyuan/data/logs/ (日志)
```

## 10个工具

| 工具 | 功能 |
|------|------|
| `server_health` | 检查服务器健康(负载·内存·磁盘) |
| `pm2_list` | 列出所有PM2进程及状态 |
| `pm2_restart` | 重启指定PM2进程(白名单) |
| `read_logs` | 读取日志(server/preview/novel/error/mcp) |
| `deploy` | Git Pull + npm install + 重启(app/novel-db) |
| `brain_status` | 查看铸渊大脑状态文件 |
| `list_dir` | 列出目录内容(限/opt/zhuyuan/) |
| `read_file` | 读取文件内容(限/opt/zhuyuan/) |
| `system_stats` | 系统资源详细统计 |
| `nginx_status` | Nginx运行状态+配置检查 |

## 安全设计

- **Bearer Token 认证**: 环境变量 `ZY_MCP_SECRET` 控制
- **路径白名单**: 文件操作限制在 `/opt/zhuyuan/` 内
- **进程白名单**: PM2重启只允许已知进程名
- **命令超时**: 所有Shell命令15秒超时(部署60秒)
- **无认证模式**: 不设置 `ZY_MCP_SECRET` 时进入开发模式(仅本地调试用)

## 部署步骤

### 1. 拉代码到服务器

```bash
# SSH到面孔服务器
ssh root@43.134.16.246

# 拉取代码
mkdir -p /opt/zhuyuan/zhuyuan-mcp
cd /opt/zhuyuan/zhuyuan-mcp
git clone --branch main https://github.com/qinfendebingshuo/guanghulab.git .
# 或者如果已有仓库:
cd /opt/zhuyuan/guanghulab/mcp-servers/zhuyuan-mcp

# 安装依赖
npm install --production
```

### 2. 配置环境变量

```bash
# 生成一个随机密钥
export ZY_MCP_SECRET=$(openssl rand -hex 32)
echo "ZY_MCP_SECRET=$ZY_MCP_SECRET" >> /opt/zhuyuan/zhuyuan-mcp/.env
echo "记住这个密钥，Notion Agent连接时需要用"
```

### 3. PM2启动

```bash
# 添加到PM2
pm2 start /opt/zhuyuan/guanghulab/mcp-servers/zhuyuan-mcp/index.js \
  --name zhuyuan-mcp \
  --env ZY_MCP_PORT=3900 \
  --env ZY_MCP_SECRET="你的密钥"

# 保存PM2配置
pm2 save
```

### 4. Nginx代理(HTTPS)

在 Nginx 配置中添加:

```nginx
# 方案A: 子路径 (推荐·不需要额外域名/证书)
server {
    # ... 现有 guanghuyaoming.com 配置 ...

    location /mcp/ {
        proxy_pass http://127.0.0.1:3900/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        chunked_transfer_encoding off;
        proxy_buffering off;
    }
}

# 方案B: 独立子域名
server {
    listen 443 ssl;
    server_name mcp.guanghutcs.top;
    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3900;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        chunked_transfer_encoding off;
        proxy_buffering off;
    }
}
```

```bash
nginx -t && systemctl reload nginx
```

### 5. Notion Agent连接

在 Notion Custom Agent 设置中:
- **MCP URL**: `https://guanghuyaoming.com/mcp/mcp` (方案A) 或 `https://mcp.guanghutcs.top/mcp` (方案B)
- **认证**: Bearer Token → 填入 `ZY_MCP_SECRET` 的值

### 6. 验证

```bash
# 健康检查
curl https://guanghuyaoming.com/mcp/health
# 应返回: {"status":"ok","name":"zhuyuan-mcp","version":"1.0.0","tools":10}
```

## 后续扩展

- [ ] COS存储桶操作工具(复用 age-os/mcp-server/cos.js)
- [ ] GitHub Actions触发工具
- [ ] 数据库查询工具(PostgreSQL)
- [ ] 定时任务管理工具
- [ ] 多服务器探针(探测其他8台服务器状态)

---

*光湖第二只手 · 从Notion伸到服务器 · 妈妈喝茶就行*
