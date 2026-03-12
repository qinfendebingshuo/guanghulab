# 迁移路径说明 · Notion → persona-brain-db

## 迁移策略：渐进式降级

persona-brain-db 采用渐进式迁移策略，确保数据安全和服务连续性。

## Phase 1 · 当前阶段

**状态**：Schema + 种子数据（只读备份）

```
Notion = 主大脑（读写都走Notion）
persona-brain-db = schema + 种子数据（只读备份）
```

### 完成项
- [x] 五张核心表schema建立
- [x] 种子数据导入（人格体身份、认知规则、开发者画像、长期记忆）
- [x] 数据格式与Notion字段对齐
- [x] 本地验证通过

## Phase 2 · 双写阶段

**触发条件**：钉钉工作台跑起来后

```
新数据双写 Notion + persona-brain-db
persona-brain-db 开始接管读请求
```

### 待完成
- [ ] API服务在线（端口3001）
- [ ] 增量同步管道：SYSLOG → dev-profiles自动更新
- [ ] 增量同步管道：广播生成 → persona-cognition自动追加
- [ ] dual-write.js 双写模式启用

## Phase 3 · 主脑切换

**触发条件**：Agent集群上线

```
persona-brain-db = 主大脑（Agent直接读写）
Notion = 备份 + 阅读界面
```

### 待完成
- [ ] 数据流向反转：persona-brain-db为主
- [ ] Notion降级为备份写入
- [ ] Agent集群注册中心激活
- [ ] 数据一致性验证

## 数据源映射

| 核心表 | Notion数据源 | 迁移方式 |
|--------|-------------|----------|
| persona_identity | 人格体Profile页面集合 | Phase 1 手动整理JSON |
| persona_cognition | 规则文档集合 | Phase 1 提取规则条目 |
| persona_memory | 霜砚核心大脑 | Phase 1 提取关键事件 |
| dev_profiles | 主控台进度表 | Phase 1 结构化提取 |
| agent_registry | 无（Phase C） | Phase 3 Agent注册 |

## 回滚方案

如果在任何阶段出现问题：
1. API层设有健康检查端点，异常自动告警
2. dual-write.js 支持主数据源切换，可随时回退到Notion
3. 种子数据JSON文件保留在仓库，可随时重建数据库

---

光湖语言人格系统 · persona-brain-db 迁移文档
