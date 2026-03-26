# Grid-DB 架构设计文档

> 项目编号：PRJ-GDB-001
> 版权：国作登字-2026-A-00037559
> 版本：v0.1.0 · Phase 0
> 签发：AG-SY-01 霜砚 · 执行：AG-ZY-01 铸渊

---

## 1. 本体论锚定 [ONT-PATCH-006]

### Grid-DB · 纸 · 格子 · 笔迹

**Grid-DB = 纸**

笔需要纸来承载笔迹。Grid-DB 是纸。纸上有格子（格点），每个格子是最小寻址单元。
纸不属于笔，纸属于写字的人。

**格点 = 格子**

格子是纸上的最小单元。不同的格子存不同的数据。
同一个格子可以有多层（raw → cleaned → indexed → semantic）。

**事件 = 笔迹**

每写一笔，笔迹就留在了历史中，不可篡改。
天眼通过观察笔迹，发现异常行为。

### 与 EXE-Engine 的关系

| 层 | 组件 | 职责 | 本体论 |
|---|---|---|---|
| 执行层 | EXE-Engine | 模型调度、任务编排、算力路由 | 笔 |
| 存储层 | Grid-DB | 数据持久化、格点索引、事件流 | 纸 |
| 采集层 | DC v1.0 | 外部数据采集与清洗 | 墨水收集器 |

---

## 2. 核心组件

### 2.1 GridCell — 格点数据模型

文件：`src/core/grid-cell.js`

四元组寻址：`(namespace, grid_x, grid_y, layer)`

- **namespace** — 隔离不同 Agent / 项目的数据域
- **grid_x / grid_y** — 坐标轴
- **layer** — 数据层级：raw → cleaned → indexed → semantic

支持：
- JSON 序列化 / 反序列化
- 二进制 Buffer 编解码（用于页存储）
- 键生成（`toKey()` → `ns:x:y:layer`）
- 曼哈顿距离计算

### 2.2 WAL — Write-Ahead Log

文件：`src/storage/wal.js`

所有写操作先追加到 WAL 文件，崩溃后可从 WAL 恢复。

记录格式：
```
[length:4][seqNo:4][op:1][keyLen:2][key:N][dataLen:4][data:M][checksum:4]
```

操作码：
- `0x01` = PUT
- `0x02` = DELETE

特性：
- 追加写入 + fsync 保证持久化
- XOR 校验和验证完整性
- 支持截断（checkpoint 后清除已持久化记录）
- 崩溃恢复：重新打开时自动读取并恢复

### 2.3 PageManager — 页管理器

文件：`src/storage/page-manager.js`

以固定大小页（默认 4096 字节）为最小 I/O 单位。

文件结构：
```
[Header: 1 page] [Page 1] [Page 2] ... [Page N]
```

Header 页：`[magic:4][version:2][pageSize:4][pageCount:4][freeListHead:4]`
数据页：`[flags:1][nextFree:4][dataLen:4][data:N]`

特性：
- 空闲链表管理：释放的页自动回收复用
- 持久化：重新打开文件后数据完好
- 文件格式验证（magic number `0x47444230` = 'GDB0'）

### 2.4 EventLog — 事件溯源日志

文件：`src/events/event-log.js`

Phase 0：内存事件流（保留最近 1000 条）
Phase 1：持久化事件流 + 回放 + 订阅

每次写操作生成事件：
```json
{
  "eventId": "evt-xxxx",
  "seqNo": 1,
  "timestamp": "2026-03-26T13:00:00Z",
  "namespace": "exe-engine",
  "operation": "put",
  "gridCellKey": "exe-engine:1:2:raw",
  "payload": { "dataSize": 256 }
}
```

支持订阅回调，可被天眼系统监听。

### 2.5 GridAPI — 统一接口

文件：`src/api/grid-api.js`

协调 WAL、PageManager、EventLog 协同工作。

```javascript
const { open } = require('./grid-db/src/index');
const db = open({ dataDir: './my-data' });

// put
db.put('my-ns', { gridX: 1, gridY: 2, layer: 'raw' }, { hello: 'world' });

// get
const data = db.get('my-ns', { gridX: 1, gridY: 2, layer: 'raw' });

// scan
const results = db.scan('my-ns', { xRange: [0, 10], yRange: [0, 10], layer: 'raw' });

// delete
db.delete('my-ns', { gridX: 1, gridY: 2, layer: 'raw' });

// subscribe
db.subscribe('auditor', (event) => console.log(event));

// checkpoint (truncate WAL)
db.checkpoint();

db.close();
```

---

## 3. 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 语言 | Node.js 20 | 与 EXE-Engine 同栈 |
| 持久化 | 自研 (.gdb/.wal) | 零外部依赖，嵌入式 |
| 序列化 | JSON + Binary Buffer | JSON 调试友好，Buffer 高性能 |
| 测试 | 自定义 assert runner | 与 EXE-Engine 测试框架统一 |

---

## 4. Phase 路线

| Phase | 目标 | 状态 |
|---|---|---|
| P0 基础骨架 | GridCell + WAL + PageManager + EventLog + GridAPI | 🟢 完成 |
| P1 索引与查询 | B+Tree + Namespace 隔离 + 范围扫描 + Event 持久化 | ⚪ 待开始 |
| P2 高级特性 | HNSW 向量索引 + EXE-Engine 对接 + DC 迁移 + 天眼审计 | ⚪ 待开始 |
| P3 生产就绪 | 性能基准 + 资源计量 + 全文索引 + 文档 | ⚪ 待开始 |
