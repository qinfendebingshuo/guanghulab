# Notion Sync Service · PY-A04-20260425-001

Notion→本地 同步器 MVP — 将 Notion 页面内容导出为结构化 JSONL 训练语料。

## 架构参考

参考 `message-router.js` 的 classify→route→handle 模式，本服务采用：
- **webhook 接收** → 事件驱动同步
- **手动触发** → 按需拉取
- **增量同步** → 基于 `last_sync_time` 跳过未修改页面

## 文件说明

| 文件 | 职责 |
|------|------|
| `sync_notion.py` | FastAPI 主服务（webhook + 手动同步 + 健康检查） |
| `export_formatter.py` | Notion 页面 → JSONL 语料格式化器 |
| `config.py` | 配置项（Notion token 占位 / 页面列表 / 导出路径） |
| `test_export_formatter.py` | JSONL 格式正确性验证测试 |

## 快速开始

```bash
pip install -r requirements.txt
python sync_notion.py
```

服务默认监听 `0.0.0.0:8400`。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 健康检查 |
| `GET` | `/status` | 同步状态（last_sync_time / target_pages） |
| `POST` | `/sync` | 手动触发同步（可指定 page_ids / force） |
| `POST` | `/webhook` | Notion webhook 接收器 |

## JSONL 输出格式

每行一个 JSON 对象：
```json
{"role": "page", "content": "页面正文", "timestamp": "2026-04-25T03:00:00Z", "source_url": "https://notion.so/..."}
```

## 测试

```bash
python test_export_formatter.py
```

## 约束

- Python 3.10+ · FastAPI · UTF-8
- 依赖：stdlib + fastapi + httpx + pydantic
- 编号前缀：PY-A04-
- 目录隔离：`/guanghu-self-hosted/notion-sync/`
- 禁触文件：`message-router.js`（只读参考）
