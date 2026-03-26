// grid-db/tests/smoke/grid-db.test.js
// Grid-DB · 冒烟测试
// PRJ-GDB-001 · Phase 0 · ZY-GDB-P0-005
// 版权：国作登字-2026-A-00037559

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  open,
  GridAPI,
  GridCell,
  WAL,
  PageManager,
  EventLog
} = require('../../src/index');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    // eslint-disable-next-line no-console
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    // eslint-disable-next-line no-console
    console.error(`  ❌ ${message}`);
  }
}

/**
 * 创建临时测试目录
 * @param {string} suffix
 * @returns {string}
 */
function makeTempDir(suffix) {
  const { randomUUID } = require('crypto');
  const dir = path.join(os.tmpdir(), `griddb-test-${suffix}-${randomUUID().slice(0, 8)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * 递归删除目录
 * @param {string} dir
 */
function cleanDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
}

// eslint-disable-next-line no-console
console.log('🗄️ Grid-DB 冒烟测试 · Phase 0\n');

// ── 测试 1: 模块导出 ──
// eslint-disable-next-line no-console
console.log('── 测试 1: 模块导出完整性 ──');
assert(typeof open === 'function', 'open 是函数');
assert(typeof GridAPI === 'function', 'GridAPI 是构造函数');
assert(typeof GridCell === 'function', 'GridCell 是构造函数');
assert(typeof WAL === 'function', 'WAL 是构造函数');
assert(typeof PageManager === 'function', 'PageManager 是构造函数');
assert(typeof EventLog === 'function', 'EventLog 是构造函数');

// ── 测试 2: GridCell 四元组寻址 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 2: GridCell 四元组寻址 ──');
const cell1 = new GridCell('agent-zy', 10, 20, 'raw');
assert(cell1.namespace === 'agent-zy', 'namespace 正确');
assert(cell1.gridX === 10, 'gridX 正确');
assert(cell1.gridY === 20, 'gridY 正确');
assert(cell1.layer === 'raw', 'layer 正确');
assert(cell1.toKey() === 'agent-zy:10:20:raw', 'toKey() 正确');

// fromKey 还原
const cell2 = GridCell.fromKey('test-ns:5:15:semantic');
assert(cell2.namespace === 'test-ns', 'fromKey namespace 正确');
assert(cell2.gridX === 5, 'fromKey gridX 正确');
assert(cell2.gridY === 15, 'fromKey gridY 正确');
assert(cell2.layer === 'semantic', 'fromKey layer 正确');

// 序列化 / 反序列化
const serialized = cell1.serialize();
assert(serialized.namespace === 'agent-zy', 'serialize namespace');
assert(serialized.grid_x === 10, 'serialize grid_x');
assert(serialized.grid_y === 20, 'serialize grid_y');
assert(serialized.layer === 'raw', 'serialize layer');

const cell3 = GridCell.deserialize(serialized);
assert(cell3.equals(cell1), 'deserialize → equals 原始格点');

// 二进制序列化
const buf = cell1.toBuffer();
assert(buf instanceof Buffer, 'toBuffer 返回 Buffer');
const { cell: cell4, bytesRead } = GridCell.fromBuffer(buf);
assert(cell4.equals(cell1), 'fromBuffer → equals 原始格点');
assert(bytesRead === buf.length, 'bytesRead 等于 buffer 长度');

// 距离计算
assert(cell1.distanceTo(cell2) === 10, 'distanceTo 曼哈顿距离正确');

// 无效参数
let errThrown = false;
try { new GridCell('', 0, 0); } catch { errThrown = true; }
assert(errThrown, '空 namespace 抛出错误');

errThrown = false;
try { new GridCell('ns', 0, 0, 'invalid'); } catch { errThrown = true; }
assert(errThrown, '无效 layer 抛出错误');

// ── 测试 3: WAL 基础功能 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 3: WAL 基础功能 ──');
const walDir = makeTempDir('wal');
const wal = new WAL(path.join(walDir, 'test.wal'));

const seq1 = wal.appendPut('ns:1:2:raw', Buffer.from('{"hello":"world"}'));
assert(seq1 === 1, 'appendPut 返回序列号 1');

const seq2 = wal.appendPut('ns:3:4:raw', Buffer.from('{"foo":"bar"}'));
assert(seq2 === 2, 'appendPut 返回序列号 2');

const seq3 = wal.appendDelete('ns:1:2:raw');
assert(seq3 === 3, 'appendDelete 返回序列号 3');

assert(wal.getSeqNo() === 3, 'getSeqNo 正确');

// 恢复
const entries = wal.recover();
assert(entries.length === 3, '恢复 3 条记录');
assert(entries[0].op === WAL.OP_PUT, '记录 1 是 PUT');
assert(entries[0].key === 'ns:1:2:raw', '记录 1 键正确');
assert(entries[1].op === WAL.OP_PUT, '记录 2 是 PUT');
assert(entries[2].op === WAL.OP_DELETE, '记录 3 是 DELETE');

// 截断
wal.truncate();
assert(wal.getSeqNo() === 0, '截断后序列号归零');
const afterTrunc = wal.recover();
assert(afterTrunc.length === 0, '截断后无记录');

wal.close();

// 崩溃恢复测试：写入 → 关闭 → 重新打开 → 验证
const wal2 = new WAL(path.join(walDir, 'crash.wal'));
wal2.appendPut('crash:1:1:raw', Buffer.from('{"data":"survive"}'));
wal2.appendPut('crash:2:2:raw', Buffer.from('{"data":"also"}'));
wal2.close();

const wal3 = new WAL(path.join(walDir, 'crash.wal'));
const recovered = wal3.recover();
assert(recovered.length === 2, '崩溃恢复：2 条记录');
assert(recovered[0].key === 'crash:1:1:raw', '崩溃恢复：键正确');
assert(wal3.getSeqNo() === 2, '崩溃恢复：序列号正确');
wal3.close();
cleanDir(walDir);

// ── 测试 4: PageManager 基础功能 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 4: PageManager 基础功能 ──');
const pmDir = makeTempDir('pm');
const pm = new PageManager(path.join(pmDir, 'test.gdb'));

// 分配页
const p1 = pm.allocPage();
assert(p1 === 1, '首页号 = 1');

const p2 = pm.allocPage();
assert(p2 === 2, '第二页号 = 2');

// 写入数据
const testData = Buffer.from('Hello Grid-DB!');
pm.writePage(p1, testData);

// 读取数据
const readData = pm.readPage(p1);
assert(readData !== null, '读取非 null');
assert(readData.toString() === 'Hello Grid-DB!', '读取数据正确');

// 写入更长数据
const longData = Buffer.from(JSON.stringify({ msg: '格点数据库测试', num: 42, arr: [1, 2, 3] }));
pm.writePage(p2, longData);
const readLong = pm.readPage(p2);
assert(readLong !== null, '读取长数据非 null');
assert(JSON.parse(readLong.toString()).num === 42, '长数据内容正确');

// 释放页
pm.freePage(p1);
const freedData = pm.readPage(p1);
assert(freedData === null, '释放后读取返回 null');

// 释放的页被复用
const p3 = pm.allocPage();
assert(p3 === 1, '释放的页号被复用');

// 状态
const pmStatus = pm.getStatus();
assert(pmStatus.pageSize === 4096, '页大小 = 4096');
assert(pmStatus.pageCount === 2, '页数 = 2');

pm.close();

// 重新打开验证持久化
const pm2 = new PageManager(path.join(pmDir, 'test.gdb'));
const rereadLong = pm2.readPage(2);
assert(rereadLong !== null, '重新打开后读取非 null');
assert(JSON.parse(rereadLong.toString()).num === 42, '持久化数据正确');
pm2.close();
cleanDir(pmDir);

// ── 测试 5: EventLog 基础功能 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 5: EventLog 基础功能 ──');
const eventLog = new EventLog({ maxEvents: 5 });

const evt1 = eventLog.append('ns1', 'put', 'ns1:1:1:raw', { size: 100 });
assert(evt1.eventId.startsWith('evt-'), '事件 ID 前缀正确');
assert(evt1.seqNo === 1, '事件序号 = 1');
assert(evt1.namespace === 'ns1', '事件命名空间正确');

eventLog.append('ns1', 'put', 'ns1:2:2:raw');
eventLog.append('ns2', 'delete', 'ns2:3:3:raw');

const recent = eventLog.getRecent(10);
assert(recent.length === 3, '最近事件 = 3');

const ns1Events = eventLog.getByNamespace('ns1');
assert(ns1Events.length === 2, 'ns1 事件 = 2');

// 订阅测试
let received = null;
const unsub = eventLog.subscribe('test-sub', (evt) => { received = evt; });
eventLog.append('ns1', 'put', 'ns1:4:4:raw');
assert(received !== null, '订阅回调收到事件');
assert(received.operation === 'put', '订阅事件操作正确');

unsub();
received = null;
eventLog.append('ns1', 'put', 'ns1:5:5:raw');
assert(received === null, '取消订阅后不再收到事件');

// 容量控制
eventLog.append('ns1', 'put', 'ns1:6:6:raw');
eventLog.append('ns1', 'put', 'ns1:7:7:raw');
const status = eventLog.getStatus();
assert(status.totalEvents === 5, '容量控制：最多保留 5 条');

// ── 测试 6: GridAPI · put → get → delete 全链路 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 6: GridAPI · put → get → delete 全链路 ──');
const apiDir = makeTempDir('api');
const db = open({ dataDir: apiDir });

// put
const putResult = db.put('exe-engine', { gridX: 1, gridY: 2, layer: 'raw' }, {
  agentId: 'AG-ZY-01',
  context: { repo: 'guanghulab', branch: 'main' },
  timestamp: '2026-03-26T13:00:00Z'
});
assert(putResult.key === 'exe-engine:1:2:raw', 'put 返回正确 key');
assert(putResult.seqNo === 1, 'put 返回序列号 1');
assert(putResult.event.operation === 'put', 'put 生成事件');

// get
const getData = db.get('exe-engine', { gridX: 1, gridY: 2, layer: 'raw' });
assert(getData !== null, 'get 返回数据');
assert(getData.agentId === 'AG-ZY-01', 'get 数据内容正确');
assert(getData.context.repo === 'guanghulab', 'get 嵌套数据正确');

// get 不存在的格点
const noData = db.get('exe-engine', { gridX: 99, gridY: 99, layer: 'raw' });
assert(noData === null, 'get 不存在的格点返回 null');

// 更新
db.put('exe-engine', { gridX: 1, gridY: 2, layer: 'raw' }, {
  agentId: 'AG-ZY-01',
  context: { repo: 'guanghulab', branch: 'feature' },
  timestamp: '2026-03-26T14:00:00Z'
});
const updatedData = db.get('exe-engine', { gridX: 1, gridY: 2, layer: 'raw' });
assert(updatedData.context.branch === 'feature', '更新后数据正确');

// 多命名空间隔离
db.put('dc-v1', { gridX: 1, gridY: 2, layer: 'raw' }, { source: 'notion' });
const dcData = db.get('dc-v1', { gridX: 1, gridY: 2, layer: 'raw' });
assert(dcData.source === 'notion', '不同命名空间数据隔离');

const exeData = db.get('exe-engine', { gridX: 1, gridY: 2, layer: 'raw' });
assert(exeData.agentId === 'AG-ZY-01', '原命名空间数据不受影响');

// delete
const deleted = db.delete('exe-engine', { gridX: 1, gridY: 2, layer: 'raw' });
assert(deleted === true, 'delete 返回 true');

const afterDelete = db.get('exe-engine', { gridX: 1, gridY: 2, layer: 'raw' });
assert(afterDelete === null, '删除后 get 返回 null');

// delete 不存在的
const deleteMissing = db.delete('exe-engine', { gridX: 99, gridY: 99, layer: 'raw' });
assert(deleteMissing === false, 'delete 不存在的格点返回 false');

// ── 测试 7: 范围扫描 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 7: 范围扫描 ──');
db.put('scan-ns', { gridX: 1, gridY: 1, layer: 'raw' }, { id: 'a' });
db.put('scan-ns', { gridX: 2, gridY: 2, layer: 'raw' }, { id: 'b' });
db.put('scan-ns', { gridX: 3, gridY: 3, layer: 'raw' }, { id: 'c' });
db.put('scan-ns', { gridX: 5, gridY: 5, layer: 'indexed' }, { id: 'd' });

const scanAll = db.scan('scan-ns');
assert(scanAll.length === 4, '扫描全部 = 4');

const scanRange = db.scan('scan-ns', { xRange: [1, 3], yRange: [1, 3] });
assert(scanRange.length === 3, '范围扫描 [1,3] = 3 条');

const scanLayer = db.scan('scan-ns', { layer: 'indexed' });
assert(scanLayer.length === 1, '按 layer 过滤 = 1 条');
assert(scanLayer[0].data.id === 'd', '过滤结果正确');

// ── 测试 8: stats ──
// eslint-disable-next-line no-console
console.log('\n── 测试 8: stats 统计 ──');
const dbStats = db.stats('scan-ns');
assert(dbStats.namespace === 'scan-ns', 'stats 命名空间正确');
assert(dbStats.cellCount === 4, 'scan-ns 格点数 = 4');

const allStats = db.stats();
assert(allStats.namespace === '*', 'stats 全局');
assert(allStats.cellCount >= 5, '全局格点数 >= 5');
assert(allStats.wal !== undefined, 'stats 含 wal');
assert(allStats.pageManager !== undefined, 'stats 含 pageManager');
assert(allStats.eventLog !== undefined, 'stats 含 eventLog');

// ── 测试 9: checkpoint ──
// eslint-disable-next-line no-console
console.log('\n── 测试 9: checkpoint ──');
db.checkpoint();
const afterCheckpoint = db.stats();
assert(afterCheckpoint.wal.seqNo === 0, 'checkpoint 后 WAL seqNo = 0');

// 数据仍然可读
const postCheckpoint = db.get('dc-v1', { gridX: 1, gridY: 2, layer: 'raw' });
assert(postCheckpoint !== null, 'checkpoint 后数据仍可读');
assert(postCheckpoint.source === 'notion', 'checkpoint 后数据正确');

// ── 测试 10: 事件订阅 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 10: 事件订阅 ──');
let subscribedEvent = null;
const unsubscribe = db.subscribe('test-audit', (evt) => {
  subscribedEvent = evt;
});

db.put('audit-ns', { gridX: 0, gridY: 0, layer: 'raw' }, { audit: true });
assert(subscribedEvent !== null, '事件订阅收到事件');
assert(subscribedEvent.namespace === 'audit-ns', '订阅事件命名空间正确');

unsubscribe();
subscribedEvent = null;
db.put('audit-ns', { gridX: 1, gridY: 1, layer: 'raw' }, { audit: false });
assert(subscribedEvent === null, '取消订阅后不再收到');

db.close();
cleanDir(apiDir);

// ── 测试 11: open() 便捷函数 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 11: open() 便捷函数 ──');
const openDir = makeTempDir('open');
const db2 = open({ dataDir: openDir });
assert(db2 instanceof GridAPI, 'open 返回 GridAPI 实例');

db2.put('test', { gridX: 0, gridY: 0, layer: 'raw' }, 'hello');
const result = db2.get('test', { gridX: 0, gridY: 0, layer: 'raw' });
assert(result === 'hello', 'open → put → get 正确');

db2.close();
cleanDir(openDir);

// ── 测试 12: GridCell 使用 GridCell 对象调用 API ──
// eslint-disable-next-line no-console
console.log('\n── 测试 12: GridCell 对象直接调用 API ──');
const gcDir = makeTempDir('gc');
const db3 = open({ dataDir: gcDir });

const myCell = new GridCell('my-ns', 42, 84, 'cleaned');
db3.put('my-ns', myCell, { value: 'direct cell' });

const directResult = db3.get('my-ns', myCell);
assert(directResult !== null, 'GridCell 对象直接调用 get');
assert(directResult.value === 'direct cell', '数据正确');

db3.close();
cleanDir(gcDir);

// ── 测试结果汇总 ──
// eslint-disable-next-line no-console
console.log('\n══════════════════════════════════════');
// eslint-disable-next-line no-console
console.log('🗄️ Grid-DB 冒烟测试完成');
// eslint-disable-next-line no-console
console.log(`   ✅ 通过: ${passed}`);
// eslint-disable-next-line no-console
console.log(`   ❌ 失败: ${failed}`);
// eslint-disable-next-line no-console
console.log(`   📊 总计: ${passed + failed}`);
// eslint-disable-next-line no-console
console.log('══════════════════════════════════════\n');

if (failed > 0) {
  process.exit(1);
}
