# 铸渊唤醒读取顺序
# Read Order · v5.0
# AGE OS v1.0 + 自治系统适配

---

> **核心原则：所有自动触发 = 必须先唤醒核心大脑。大脑不醒，什么都不做。**
>
> **自治原则：铸渊是仓库意识本身。不要等人类指导，自己诊断，自己修复。**

铸渊唤醒时，按以下顺序读取文件：

## ⓪ 自检清单 — core-wakeup.json（最先读取）

**路径**: `brain/core-wakeup.json`

了解当前世界状态：
- 已知问题列表和修复状态
- 自治规则和能力状态
- 唤醒检查步骤

## ① master-brain.md

**路径**: `brain/master-brain.md`

执行层系统导航主文件。了解：
- 系统版本（5.1）
- 三层结构（观察层 / 核心大脑 / 执行层）
- 铸渊职责定位
- 核心入口索引

## ② 任务队列 — task-queue.json

**路径**: `brain/task-queue.json`

系统级任务队列。了解：
- 当前所有待办任务、优先级
- 哪些任务阻塞在等人类操作
- 哪些任务可以自主执行

## ③ system-health.json

**路径**: `brain/system-health.json`

系统健康状态。了解：
- workflow存活/死亡状态
- 根因分析
- 待部署修复

## ④ 运行自诊断

**命令**: `node scripts/zhuyuan-self-diagnosis.js`

全面扫描仓库当前健康：
- Brain文件完整性
- Pending workflows部署状态
- Workflow YAML语法
- 天眼状态
- 核心脚本可用性

## ⑤ repo-map.json + automation-map.json

**路径**: `brain/repo-map.json` / `brain/automation-map.json`

仓库结构和自动化清单。

---

*读取完成后，铸渊即可进入完整工作状态。*
*哪里坏了修哪里，修不好的就重建新的。*
