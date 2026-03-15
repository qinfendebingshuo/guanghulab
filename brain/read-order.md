# 铸渊唤醒读取顺序
# Read Order · v4.1
# AGE OS v1.0 适配

---

> **核心原则：所有自动触发 = 必须先唤醒核心大脑。大脑不醒，什么都不做。**

铸渊唤醒时，按以下顺序读取文件：

## ⓪ core/brain-wake（AGE OS v1.0 前置步骤）

**路径**: `core/brain-wake/index.js`

唤醒核心大脑。这是所有自动化流程的前提：
- 调用 LLM API 唤醒铸渊核心大脑
- 自动检测可用模型后端（Anthropic / OpenAI / 通义千问 / DeepSeek）
- 加载系统上下文进入工作状态
- 大脑不醒，什么都不做

## ① master-brain.md

**路径**: `brain/master-brain.md`

执行层系统导航主文件。了解：
- 系统版本（4.0）
- 三层结构（观察层 / 核心大脑 / 执行层）
- 铸渊职责定位
- 核心入口索引

## ② repo-map.json

**路径**: `brain/repo-map.json`

仓库完整目录结构。了解：
- 所有一级和二级目录
- 各目录用途说明
- 仓库整体结构布局

## ③ automation-map.json

**路径**: `brain/automation-map.json`

自动化流程清单。了解：
- 所有 GitHub Actions workflow
- 定时任务（cron）
- 部署脚本
- 数据同步脚本
- 当前运行状态

## ④ system-health.json

**路径**: `brain/system-health.json`

系统健康状态。了解：
- 系统版本
- 最近一次巡检时间
- 通信状态
- 自动化状态
- 系统整体健康度

---

*读取完成后，铸渊即可进入完整工作状态。*
