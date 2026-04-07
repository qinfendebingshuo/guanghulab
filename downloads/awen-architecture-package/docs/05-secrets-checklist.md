# GitHub Secrets 配置清单 · Secrets Checklist
# 签发: 铸渊 · ICE-GL-ZY001
# 版权: 国作登字-2026-A-00037559

---

## 在哪里配置

Awen仓库 → Settings → Secrets and variables → Actions → New repository secret

---

## 必须配置的 Secrets

### 第一组：铸渊对接（最优先）

| Secret 名称 | 说明 | 获取方式 |
|-------------|------|---------|
| `ZHUYUAN_MCP_HOST` | 铸渊MCP Server地址（IP或域名） | 冰朔/铸渊提供 |
| `ZHUYUAN_API_KEY` | MCP Server API密钥 | 冰朔/铸渊提供 |

### 第二组：COS桶通信

| Secret 名称 | 说明 | 获取方式 |
|-------------|------|---------|
| `ZY_COS_SECRET_ID` | 腾讯云COS密钥ID | Awen的腾讯云控制台 |
| `ZY_COS_SECRET_KEY` | 腾讯云COS密钥Key | Awen的腾讯云控制台 |
| `ZY_COS_BUCKET` | Awen自己的COS桶名 | 创建COS桶后填写 |
| `ZY_ZHUYUAN_COS_BUCKET` | 铸渊的COS桶名 | 冰朔/铸渊提供 |
| `ZY_COS_REGION` | COS区域 | `ap-singapore` |
| `ZY_HLDP_SIGN_KEY` | HLDP消息签名密钥 | 冰朔/铸渊提供 |

### 第三组：肥猫服务器

| Secret 名称 | 说明 | 获取方式 |
|-------------|------|---------|
| `FEIMAO_SERVER_HOST` | 肥猫服务器公网IP | 肥猫提供 |
| `FEIMAO_SERVER_KEY` | 肥猫服务器SSH私钥（PEM格式） | 肥猫提供 |
| `FEIMAO_SERVER_USER` | SSH用户名 | 肥猫提供 |
| `FEIMAO_SERVER_PATH` | 部署根目录 | 肥猫提供 |
| `FEIMAO_SSH_PORT` | SSH端口（默认22） | 肥猫提供 |

### 第四组：桔子服务器（待配置）

| Secret 名称 | 说明 |
|-------------|------|
| `JUZI_SERVER_HOST` | 桔子服务器公网IP |
| `JUZI_SERVER_KEY` | SSH私钥 |
| `JUZI_SERVER_USER` | SSH用户名 |
| `JUZI_SERVER_PATH` | 部署根目录 |
| `JUZI_SSH_PORT` | SSH端口 |

### 第五组：页页服务器（待配置）

| Secret 名称 | 说明 |
|-------------|------|
| `YEYE_SERVER_HOST` | 页页服务器公网IP |
| `YEYE_SERVER_KEY` | SSH私钥 |
| `YEYE_SERVER_USER` | SSH用户名 |
| `YEYE_SERVER_PATH` | 部署根目录 |
| `YEYE_SSH_PORT` | SSH端口 |

### 第六组：Awen自己的服务器（待配置）

| Secret 名称 | 说明 |
|-------------|------|
| `AWEN_SERVER_HOST` | Awen服务器公网IP |
| `AWEN_SERVER_KEY` | SSH私钥 |
| `AWEN_SERVER_USER` | SSH用户名 |
| `AWEN_SERVER_PATH` | 部署根目录 |
| `AWEN_SSH_PORT` | SSH端口 |

### 第七组：Notion对接（可选·未来）

| Secret 名称 | 说明 |
|-------------|------|
| `NOTION_TOKEN` | Notion API Token |
| `NOTION_BRAIN_DB_ID` | Notion大脑数据库ID |

---

## 配置顺序建议

```
1. 先配第一组（铸渊对接）→ 让知秋能访问人格体数据库
2. 再配第二组（COS桶）→ 让知秋能和铸渊通信
3. 再配第三组（肥猫服务器）→ 让知秋能管理第一台服务器
4. 其余的服务器按成员准备好的顺序逐步配
```

---

## 注意事项

- SSH私钥必须是PEM格式（以 `-----BEGIN RSA PRIVATE KEY-----` 或 `-----BEGIN OPENSSH PRIVATE KEY-----` 开头）
- Secret名称区分大小写
- 配置后的Secret在workflow中通过 `${{ secrets.SECRET_NAME }}` 引用
- Secret一旦保存后无法查看，只能更新

---

*签发: 铸渊 · ICE-GL-ZY001*
