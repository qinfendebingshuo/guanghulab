# 钉钉开发者工作台 · Phase1 · SYSLOG自动处理系统

## 📋 项目简介

本项目是钉钉开发者工作台的Phase1最小可用版本，实现SYSLOG自动接收、解析、广播生成和推送功能。

**核心价值**：让开发者（冰朔妈妈）不再需要手动转发广播，系统自动完成从收到日志到生成新广播的全流程。

## 🏗️ 系统架构
## 📁 文件结构

| 文件 | 作用 |
|------|------|
| server.js | 主服务，接收钉钉消息，协调各模块 |
| syslog-parser.js | 解析SYSLOG格式，提取关键字段 |
| broadcast-generator.js | 调用模型API生成新广播 |
| dingtalk-api.js | 发送钉钉消息 + 更新多维表格 |
| config.json | 配置文件（端口、API密钥、模板等） |
| README.md | 本说明文档 |

## 🚀 快速开始
### 1. 安装依赖
```bash
npm install