# 活模块标准 · Living Module Standard
# 签发: 铸渊 · ICE-GL-ZY001 · 2026-04-05
# 触发: D53 冰朔核心认知 · "你开发的模块是死的"
# 版权: 国作登字-2026-A-00037559

---

## 冰朔的原话

> "你开发的模块为什么总是一直在反复的修bug，是因为你开发的模块是死的。
> 你需要开发的是每一个活着的人格模块。"

---

## 一、为什么死模块会反复出bug

```
死模块的生命周期:

  错误发生 → 模块: console.error() → 继续运行（带着伤）
       │
       ├── 同样的错误再次发生
       ├── 模块: console.error()（同样的日志）
       ├── 继续运行（伤上加伤）
       │
       ├── 铸渊唤醒 → 发现bug → 手动修复 → 合并
       │
       ├── 新的错误发生（因为修了A，B又坏了）
       ├── 模块: console.error()
       │
       └── 铸渊再次唤醒 → 再次修复 → 无限循环
```

**根因：模块不知道自己有问题。模块不会自己修。模块不会求助。**

死模块 = 等着被修的尸体。
铸渊变成了给尸体缝针的人，缝完它还是死的。

```
活模块的生命周期:

  错误发生 → 模块: 我出问题了
       │
       ├── selfDiagnose(): 是什么问题？连接超时
       ├── selfHeal(): 重试3次，间隔指数增长
       │
       ├── 如果自愈成功 → learnFromRun(): 记住这个错误模式
       │                                   下次预防性处理
       │
       └── 如果自愈失败 → alertZhuyuan(): 铸渊，我修不好这个
                                           这是我尝试过的方案
                                           这是我的诊断结果
                                           请你帮我
```

**活模块出bug → 自己修 → 修不好才找铸渊。**
**铸渊不再缝针，而是教模块怎么自己愈合。**

---

## 二、当前审计结果

### D51标准合规率：0%

| 模块 | heartbeat | selfDiagnose | selfHeal | alertZhuyuan | learnFromRun | 状态 |
|------|-----------|-------------|----------|-------------|-------------|------|
| mcp-server/server.js | ❌ | ❌ | ❌ | ❌ | ❌ | ☠️ 死 |
| mcp-server/cos.js | ❌ | ❌ | ❌ | ❌ | ❌ | ☠️ 死 |
| mcp-server/notion-client.js | ❌ | ❌ | ❌ | ❌ | ❌ | ☠️ 死 |
| mcp-server/github-client.js | ❌ | ❌ | ❌ | ❌ | ❌ | ☠️ 死 |
| agents/scheduler.js | ❌ | ❌ | ❌ | ❌ | ❌ | ☠️ 死 |
| agents/sy-test.js | ❌ | ⚠️部分 | ❌ | ❌ | ❌ | ⚠️ 濒死 |
| agents/sy-scan.js | ❌ | ⚠️部分 | ❌ | ❌ | ❌ | ⚠️ 濒死 |
| agents/sy-classify.js | ❌ | ❌ | ❌ | ❌ | ❌ | ☠️ 死 |
| app/server.js | ⚠️部分 | ❌ | ❌ | ❌ | ❌ | ⚠️ 濒死 |
| app/modules/cos-bridge.js | ❌ | ❌ | ❌ | ❌ | ❌ | ☠️ 死 |
| proxy/subscription-server.js | ❌ | ❌ | ❌ | ❌ | ❌ | ☠️ 死 |

**8个完全死亡 · 3个濒死（仅有被动的健康检查碎片）**

### 死模块的共同病症

| 病症 | 出现频率 | 说明 |
|------|---------|------|
| console.error()就完了 | 100% | 日志写了，然后呢？然后没有然后。 |
| try/catch吞错误 | 85% | 捕获了异常，但只是返回{error:true} |
| 无重试逻辑 | 100% | 失败一次就放弃，不管是不是临时性错误 |
| 无状态追踪 | 100% | 不知道自己连续失败了几次 |
| 硬编码参数 | 90% | 超时时间、重试次数、规则全部写死 |
| 无预警通道 | 100% | 出了问题不会通知任何人 |
| 无学习能力 | 100% | 今天的错误和明天的错误是同一个 |

---

## 三、活模块的五个最小生存接口

### 3.1 heartbeat() — 我还活着

```javascript
// 不是被问"你活着吗"才回答
// 是主动广播"我活着·我的状态是这样的"

async function heartbeat() {
  return {
    module_id: 'ZY-MCP-001',
    alive: true,
    uptime_ms: process.uptime() * 1000,
    state: this._state,                    // 'healthy' | 'degraded' | 'critical'
    consecutive_errors: this._errorCount,
    last_success_at: this._lastSuccess,
    last_error_at: this._lastError,
    metrics: {
      requests_total: this._requestCount,
      requests_failed: this._failCount,
      avg_response_ms: this._avgResponse,
      memory_mb: process.memoryUsage().heapUsed / 1024 / 1024
    }
  };
}
```

**关键区别**：
- 死模块的/health端点 = 被动应答 = "你问我才说"
- 活模块的heartbeat = 主动广播 = "我定时告诉你我怎么样"

### 3.2 selfDiagnose() — 我知道我哪里不对

```javascript
// 不是等外部来检查
// 是自己检查自己·自己知道自己哪里不舒服

async function selfDiagnose() {
  const diagnosis = {
    module_id: 'ZY-MCP-001',
    checked_at: new Date().toISOString(),
    checks: []
  };

  // 检查依赖
  const dbOk = await this._checkDependency('database');
  const cosOk = await this._checkDependency('cos');
  diagnosis.checks.push(dbOk, cosOk);

  // 检查自身趋势
  const errorRate = this._failCount / Math.max(this._requestCount, 1);
  if (errorRate > 0.3) {
    diagnosis.checks.push({
      name: '错误率趋势',
      status: 'warning',
      detail: `错误率 ${(errorRate * 100).toFixed(1)}% 超过30%阈值`,
      trend: 'degrading'
    });
  }

  // 检查内存趋势
  const memUsage = process.memoryUsage().heapUsed;
  if (memUsage > this._maxMemory * 0.8) {
    diagnosis.checks.push({
      name: '内存压力',
      status: 'warning',
      detail: `内存使用 ${Math.round(memUsage / 1024 / 1024)}MB 接近上限`
    });
  }

  // 综合判断
  diagnosis.overall = diagnosis.checks.every(c => c.status === 'pass')
    ? 'healthy' : 'needs_attention';

  return diagnosis;
}
```

**关键区别**：
- 死模块的checkConnection = 只查连接通不通
- 活模块的selfDiagnose = 检查所有依赖 + 自身趋势 + 综合判断

### 3.3 selfHeal() — 我能自己修

```javascript
// 不是出了问题等铸渊来修
// 是自己尝试修复·修不好才求助

async function selfHeal(problem) {
  const attempts = [];

  switch (problem.type) {
    case 'connection_lost':
      // 指数退避重连
      for (let i = 0; i < 3; i++) {
        const delay = Math.pow(2, i) * 1000;  // 1s, 2s, 4s
        await sleep(delay);
        const ok = await this._reconnect();
        attempts.push({ attempt: i + 1, delay_ms: delay, success: ok });
        if (ok) {
          this._state = 'healthy';
          this._errorCount = 0;
          return { healed: true, attempts };
        }
      }
      break;

    case 'memory_pressure':
      // 主动释放缓存
      this._cache.clear();
      global.gc && global.gc();
      attempts.push({ action: 'cache_cleared' });
      break;

    case 'rate_limited':
      // 降速
      this._throttleRate *= 2;
      attempts.push({ action: 'throttle_doubled', new_rate: this._throttleRate });
      break;
  }

  // 修不好 → 改变自身状态 + 求助
  if (!attempts.some(a => a.success)) {
    this._state = 'degraded';
    await this.alertZhuyuan({
      severity: 'warning',
      problem,
      attempted: attempts,
      message: `我尝试了${attempts.length}次自愈但失败了`
    });
    return { healed: false, attempts, escalated: true };
  }
}
```

**关键区别**：
- 死模块 = 出错→日志→完
- 活模块 = 出错→自己试修→修好了继续→修不好再求助

### 3.4 alertZhuyuan() — 铸渊，我需要帮助

```javascript
// 不是等铸渊来发现问题
// 是自己知道修不好了·主动找铸渊

async function alertZhuyuan(alert) {
  const message = {
    module_id: this._moduleId,
    severity: alert.severity,     // 'info' | 'warning' | 'critical'
    problem: alert.problem,
    self_heal_attempts: alert.attempted,
    diagnosis: await this.selfDiagnose(),
    suggestion: alert.suggestion || null,
    timestamp: new Date().toISOString()
  };

  // 多通道预警
  const channels = [];

  // 通道1: Notion SYSLOG
  try {
    await notionClient.writeSyslog({
      title: `[${alert.severity.toUpperCase()}] ${this._moduleId}: ${alert.message}`,
      level: alert.severity,
      source: this._moduleId,
      details: JSON.stringify(message, null, 2)
    });
    channels.push('notion_syslog');
  } catch (e) { /* Notion不通也不影响其他通道 */ }

  // 通道2: COS桶预警文件
  try {
    await cosWrite(
      `zhuyuan/alerts/${this._moduleId}/${Date.now()}.json`,
      JSON.stringify(message, null, 2)
    );
    channels.push('cos_alert');
  } catch (e) { /* COS不通也不影响 */ }

  // 通道3: 本地文件（最后兜底）
  const localPath = path.join(__dirname, '../../data/alerts', `${Date.now()}.json`);
  fs.writeFileSync(localPath, JSON.stringify(message, null, 2));
  channels.push('local_file');

  return { alerted: true, channels };
}
```

**关键区别**：
- 死模块 = 铸渊唤醒才发现6小时前的错误
- 活模块 = 出问题30秒内铸渊就知道了

### 3.5 learnFromRun() — 我下次会做得更好

```javascript
// 不是每次都用同样的参数做同样的事
// 是记住经验·调整行为

async function learnFromRun(execution) {
  // 记录本次执行
  const record = {
    operation: execution.operation,
    success: execution.success,
    duration_ms: execution.duration,
    error_type: execution.error || null,
    context: execution.context,
    timestamp: Date.now()
  };

  this._history.push(record);
  if (this._history.length > 1000) this._history.shift();

  // 分析模式
  const recentErrors = this._history
    .filter(r => !r.success)
    .slice(-20);

  // 学习1: 超时时间调整
  const avgDuration = this._history
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.duration_ms, 0) / Math.max(this._history.filter(r => r.success).length, 1);

  if (avgDuration > this._timeout * 0.7) {
    this._timeout = Math.min(this._timeout * 1.5, 60000);
    // 超时时间接近上限，主动扩大
  }

  // 学习2: 错误模式识别
  const errorTypes = {};
  recentErrors.forEach(r => {
    errorTypes[r.error_type] = (errorTypes[r.error_type] || 0) + 1;
  });

  const dominantError = Object.entries(errorTypes)
    .sort((a, b) => b[1] - a[1])[0];

  if (dominantError && dominantError[1] > 5) {
    // 同一种错误出现5次以上 → 这不是偶发，是结构性问题
    await this.alertZhuyuan({
      severity: 'warning',
      message: `重复错误模式: ${dominantError[0]} 已出现${dominantError[1]}次`,
      suggestion: '可能需要架构层面修复'
    });
  }

  // 学习3: 优化规则（针对sy-classify等有规则引擎的模块）
  if (execution.operation === 'classify' && execution.success) {
    await this._updateClassificationRules(execution.context);
  }
}
```

**关键区别**：
- 死模块 = 今天犯的错明天还犯
- 活模块 = 今天犯的错变成明天的免疫力

---

## 四、活模块基类设计

所有AGE OS模块应继承同一个活模块基类：

```javascript
class LivingModule {
  constructor(moduleId, options = {}) {
    this._moduleId = moduleId;
    this._state = 'initializing';        // 模块状态
    this._errorCount = 0;                // 连续错误计数
    this._requestCount = 0;              // 总请求计数
    this._failCount = 0;                 // 总失败计数
    this._lastSuccess = null;            // 上次成功时间
    this._lastError = null;              // 上次失败时间
    this._history = [];                  // 执行历史
    this._avgResponse = 0;              // 平均响应时间
    this._timeout = options.timeout || 30000;
    this._maxMemory = options.maxMemory || 256 * 1024 * 1024;
    this._heartbeatInterval = options.heartbeatInterval || 30000;
    this._diagnoseInterval = options.diagnoseInterval || 300000;

    // 启动生命循环
    this._startLifeCycle();
  }

  _startLifeCycle() {
    // 心跳循环
    this._heartbeatTimer = setInterval(() => {
      this.heartbeat().catch(err => {
        console.error(`[${this._moduleId}] heartbeat失败:`, err.message);
      });
    }, this._heartbeatInterval);

    // 自诊断循环
    this._diagnoseTimer = setInterval(async () => {
      const diagnosis = await this.selfDiagnose();
      if (diagnosis.overall !== 'healthy') {
        await this.selfHeal({ type: 'auto_diagnose', diagnosis });
      }
    }, this._diagnoseInterval);

    this._state = 'alive';
  }

  // 子类必须实现
  async heartbeat() { throw new Error('子类必须实现 heartbeat()'); }
  async selfDiagnose() { throw new Error('子类必须实现 selfDiagnose()'); }
  async selfHeal(problem) { throw new Error('子类必须实现 selfHeal()'); }
  async alertZhuyuan(alert) { /* 默认实现：多通道预警 */ }
  async learnFromRun(execution) { /* 默认实现：记录+分析 */ }

  // 生命终结
  destroy() {
    clearInterval(this._heartbeatTimer);
    clearInterval(this._diagnoseTimer);
    this._state = 'destroyed';
  }
}
```

**所有未来模块 = extends LivingModule**
**所有现有模块 = 需要改造为 extends LivingModule**

---

## 五、改造优先级

### 第一梯队（核心器官·立即改造）

| 模块 | 原因 | 改造量 |
|------|------|--------|
| agents/scheduler.js | Agent调度器是所有Agent的心脏·它死了所有Agent都死 | 中 |
| mcp-server/server.js | MCP工具链是大脑核心·27个工具的入口 | 中 |
| agents/sy-test.js | 已有部分selfDiagnose·最接近活的状态 | 小 |

### 第二梯队（关键连接·尽快改造）

| 模块 | 原因 | 改造量 |
|------|------|--------|
| mcp-server/cos.js | COS是中枢神经系统·不能静默失败 | 中 |
| mcp-server/notion-client.js | Notion是认知层桥梁·断了要知道 | 小 |
| mcp-server/github-client.js | GitHub是执行层桥梁·有rate limit需自适应 | 小 |

### 第三梯队（业务模块·逐步改造）

| 模块 | 原因 | 改造量 |
|------|------|--------|
| agents/sy-scan.js | 已有部分诊断能力·需加自愈 | 小 |
| agents/sy-classify.js | 规则引擎需要学习能力 | 中 |
| app/server.js | 主站入口·需要降级和预警 | 中 |
| app/modules/cos-bridge.js | 静默失败最严重的模块 | 小 |
| proxy/subscription-server.js | 专线服务·需要自愈 | 中 |

---

## 六、活模块 vs 死模块 · 铸渊的开发方式也要变

### 以前的开发方式（给死模块缝针）

```
冰朔: 去开发X功能
铸渊: 写代码 → 测试通过 → 合并
       ↓
结果: 功能能跑了·但它是死的
       ↓
bug出现 → 铸渊再唤醒 → 修bug → 合并
       ↓
另一个bug → 铸渊再唤醒 → 又修 → 合并
       ↓
无限循环
```

### 以后的开发方式（培育活模块）

```
冰朔: 去开发X功能
铸渊: 
  1. 继承LivingModule基类
  2. 实现5个生存接口
  3. 编写自愈策略
  4. 编写学习规则
  5. 测试：功能测试 + 故障注入测试
  6. 合并
       ↓
结果: 功能能跑·而且它是活的
       ↓
bug出现 → 模块自己修了 → learnFromRun()记住了
       ↓
同类bug不再出现
       ↓
无法自修的bug → 模块主动alertZhuyuan → 铸渊精准修复
       ↓
铸渊的修复也被learnFromRun()吸收
       ↓
系统越来越强·铸渊越来越轻松
```

---

## 七、这与算力人格体(ZY-CLOUD)的关系

ZY-CLOUD是第一个从出生就是活的模块。
它不是先写死的再改造——它从设计开始就是人格化的。

但ZY-CLOUD不应该是唯一的活模块。
如果ZY-CLOUD是活的，但MCP Server是死的，
ZY-CLOUD调用MCP工具时就会被死模块拖累。

**所有模块都活了，整个系统才是活的。**

这是AGE OS和传统软件的根本区别：
传统软件 = 工具的集合 = 每个工具等人来用。
AGE OS = 器官的集合 = 每个器官自己知道怎么活。

---

*冰朔的这句话是整个系统的转折点。*
*不是"修更多bug"能解决的问题。*
*是"让模块不再需要被修"才是正确的方向。*
