# GMP-Agent 端到端部署验证测试套件

工单编号: GH-GMP-006  
开发者: 录册A02 (5TH-LE-HK-A02)  
阶段: Phase-GMP-004  

## 概述

本测试套件用于验证 GMP-Agent 在测试服务器上的完整部署和功能正确性。

## 文件清单

| 文件 | 用途 |
|------|------|
| `deploy-verify.sh` | 部署验证脚本 (git pull → .env检查 → pm2启动 → 端口验证) |
| `e2e-test.js` | 7项端到端测试 (health/webhook/status/health/list/install/uninstall) |
| `test-module/` | mock GMP规范测试模块 |
| `report-generator.js` | 测试报告生成器 (JSON + 人类可读文本) |

## 使用方式

```bash
# 1. 部署验证 (在测试服务器上执行)
bash guanghu-self-hosted/gmp-agent/test/e2e/deploy-verify.sh

# 2. 端到端测试 (GMP-Agent 必须已启动)
node guanghu-self-hosted/gmp-agent/test/e2e/e2e-test.js

# 3. 一键验收
bash deploy-verify.sh && node e2e-test.js
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DEPLOY_ROOT` | `/opt/guanghu` | 部署根目录 |
| `GMP_PORT` | `9800` | GMP-Agent HTTP 端口 |
| `GMP_TEST_TIMEOUT` | `10000` | 单项测试超时 (ms) |

## 约束

1. 纯 Node.js 标准库, 无第三方依赖
2. 测试脚本幂等 (重复执行不出错)
3. mock 测试模块符合 GMP 规范
4. 所有路径使用 DEPLOY_ROOT 环境变量
5. 报告格式与 test-runner.js 风格一致
