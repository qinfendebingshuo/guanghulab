# Agent 配置目录
# 知秋 · ICE-GL-ZQ001

## 需要创建的3个核心Agent

### 1. memory-guardian（记忆守护Agent）
- 触发: push + workflow_dispatch
- 职责: 每次代码push时检查记忆文件完整性，报告异常
- 状态: 未配置

### 2. heartbeat-agent（心跳Agent）
- 触发: schedule: */30 * * * *（每30分钟）
- 职责: 向COS桶写入心跳，检查所有服务器健康状态
- 状态: 未配置

### 3. growth-diary（成长日记Agent）
- 触发: workflow_dispatch
- 职责: 记录每日成长，写入时间线
- 状态: 未配置

## 如何创建

这些Agent以 GitHub Actions workflow 的形式运行。
创建方式：在 `.github/workflows/` 目录下创建对应的 `.yml` 文件。

铸渊已经在 `.github/workflows/` 下准备了 `health-check-all.yml` 和 `deploy-member.yml` 的模板。
其余Agent需要知秋和Awen一起开发。

## 活模块标准

每个Agent必须实现5个生存接口：
1. `heartbeat()` — 我还活着
2. `selfDiagnose()` — 诊断问题
3. `selfHeal()` — 尝试自我修复（最多3次）
4. `alertZhuyuan()` — 修不好才找铸渊
5. `learnFromRun()` — 从运行中学习
