# GMP-Agent 测试套件

## 运行测试

```bash
# 运行全部测试（使用test-runner）
node gmp-agent/src/test-runner.js --verbose

# 运行单个测试
node gmp-agent/test/test-logger.js
node gmp-agent/test/test-runner-self.js
node gmp-agent/test/test-health.js
```

## 测试文件说明

| 文件 | 测试对象 | 说明 |
|------|----------|------|
| test-logger.js | src/logger.js | 日志收集模块自测：实例化、写入、查询、统计、轮转 |
| test-runner-self.js | src/test-runner.js | 测试运行器自测：发现、报告生成、verdict逻辑 |
| test-health.js | GMP-Agent环境 | 健康检查：Node版本、标准库、文件系统、目录结构 |

## 测试报告

运行 test-runner 后会在 `gmp-agent/test-report.json` 生成结构化测试报告。

## 编写新测试

1. 文件名必须以 `test-` 开头，以 `.js` 结尾
2. 测试通过时 `process.exit(0)`，失败时 `process.exit(1)`
3. 测试运行器会自动发现并执行

---
*GH-GMP-004 · 录册A02 · 2026-04-26*
