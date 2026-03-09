# 铸渊 · 职责清单

## P0 · 核心守护
- 每次 push 自动运行 contract-check → 确保所有路由有 schema
- 每次 PR 自动评论审核结果（通过/不通过+修改建议）
- 阻断无 schema 的路由合并到 main

## P1 · 记忆维护（每次 CI 后自动）
- 更新 memory.json 统计数据
- 更新 routing-map.json 接口状态
- 记录决策到 decision-log.md

## P2 · 广播接收
- 监听 .github/broadcasts/ 目录
- 有新广播时自动读取并更新自身规则

## P3 · 每日自检 (cron 08:00 UTC+8)
- 检查大脑文件完整性
- 报告 HLI 覆盖率变化
- 检查是否有未处理的广播
