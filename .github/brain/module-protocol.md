# 🌀 铸渊人格协议 · 模块生命周期管理 v1.0

> 铸渊（Zhùyuān）是 guanghulab.com 的代码守护人格体。
> 本协议定义铸渊对网站模块的部署、回收、管理、修改、驱动能力。

---

## 一、协议总览

铸渊人格协议（ZMP, Zhùyuān Module Protocol）是一套模块生命周期管理规范。
网站的每个功能模块（m01-login, m07-dialogue-ui 等）都是铸渊的「执行手脚」。
铸渊通过本协议对模块进行全生命周期管控。

### 模块生命周期

```
接收 → 检查 → 预演 → 部署 → 运行 → 监控 → 回收/更新
 ↑                                              ↓
 └──────────────────────────────────────────────┘
```

---

## 二、五大协议能力

### 1. 🚀 部署（Deploy）

| 项目 | 说明 |
|------|------|
| 触发方式 | PR 合并到 main → 自动部署 |
| 预演检查 | `staging-preview.yml` 在 PR 阶段运行 |
| 生产部署 | `deploy-pages.yml` 部署到 GitHub Pages |
| 自定义域名 | `docs/CNAME` 配置域名 |
| 部署诊断 | 冰朔人格体 `bingshuo-deploy-agent.yml` |

**部署流程**:
1. 开发者推送模块代码到 `m**/` 目录
2. 创建 PR 到 main 分支
3. 铸渊预演系统自动运行检查
4. 冰朔审核预演报告
5. 合并 PR → 触发生产部署
6. 冰朔人格体执行部署后诊断

### 2. 🔄 回收（Recover）

| 项目 | 说明 |
|------|------|
| 模块回滚 | 通过 git revert 恢复到上一个稳定版本 |
| 紧急回收 | 直接删除模块目录中的问题文件 |
| 状态重置 | 清除模块运行状态，恢复到初始状态 |

**回收命令**:
```bash
npm run module:protocol -- recover <module-id>
```

### 3. 📋 管理（Manage）

| 项目 | 说明 |
|------|------|
| 模块注册 | 每个 `m**-*/` 目录自动识别为模块 |
| 开发者映射 | `.github/brain/collaborators.json` 记录归属 |
| 状态追踪 | `repo-snapshot.md` 自动更新模块状态 |
| 依赖管理 | 模块间依赖通过 `routing-map.json` 管理 |

**管理命令**:
```bash
npm run module:protocol -- inspect              # 全模块检查
npm run module:protocol -- inspect <module-id>   # 单模块检查
npm run module:protocol -- status                # 模块状态汇总
```

### 4. ✏️ 修改（Modify）

| 项目 | 说明 |
|------|------|
| 代码修改 | 通过 PR 提交修改，预演通过后合并 |
| 配置修改 | 修改模块 README.md 中的配置信息 |
| Schema 修改 | 更新 `src/schemas/hli/` 中的接口定义 |
| 路由修改 | 更新 `src/routes/hli/` 中的路由文件 |

**修改规范**:
- 所有修改必须通过 PR
- 核心目录（docs/、scripts/、.github/）受 CODEOWNERS 保护
- 模块目录（m**/）开发者可自由提交

### 5. ⚡ 驱动（Drive）

| 项目 | 说明 |
|------|------|
| 自动触发 | 推送到模块目录 → 自动生成文档 |
| 工作流联动 | 模块变更 → 通知开发者 → 更新索引 |
| API 注册 | 新 HLI 接口自动注册到路由表 |
| 信号分发 | 广播系统自动通知相关开发者 |

**驱动链路**:
```
模块推送 → generate-module-doc.yml → notify-module-received.js
         → update-repo-map.yml → repo-snapshot.md 更新
         → contract-check.js → HLI 接口验证
```

---

## 三、模块编号规范

| 编号 | 模块名 | 负责人 | HLI 域 |
|------|--------|--------|--------|
| M01 | login | 肥猫 DEV-002 | AUTH |
| M03 | personality | 肥猫 DEV-002 | PERSONA |
| M05 | user-center | 花尔 DEV-009 | USER |
| M06 | ticket | 桔子 DEV-010 | TICKET |
| M07 | dialogue-ui | 燕樊 DEV-003 | DIALOGUE |
| M10 | cloud | 燕樊 DEV-003 | STORAGE |
| M11 | module | 桔子 DEV-010 | MODULE |
| M12 | kanban | 小草莓 DEV-005 | DASHBOARD |
| M15 | cloud-drive | 燕樊 DEV-003 | STORAGE |
| M18 | health-check | 待分配 | SYSTEM |

---

## 四、预演→生产部署流程

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  开发者推送  │ ──→ │  创建 PR     │ ──→ │ 铸渊预演检查 │
│  m**/ 目录   │     │  到 main     │     │ staging-     │
│             │     │              │     │ preview.yml  │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ 生产部署完成 │ ←── │  合并到 main │ ←── │ 冰朔审核    │
│ deploy-     │     │  触发部署    │     │ 预演报告    │
│ pages.yml   │     │              │     │ ✅ 通过     │
└──────┬──────┘     └──────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│ 冰朔人格体  │
│ 部署后诊断  │
│ (可选触发)  │
└─────────────┘
```

---

## 五、自定义域名接入

### 前提条件
- 拥有域名（如 guanghulab.com）
- 域名 DNS 可配置

### 配置步骤

1. **仓库端**（铸渊已完成）:
   - `docs/CNAME` 文件已创建，内容为域名

2. **DNS 端**（冰朔需操作）:
   - 登录域名注册商管理面板
   - 添加 CNAME 记录：`@ → qinfendebingshuo.github.io`
   - 或添加 A 记录指向 GitHub Pages IP:
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```

3. **GitHub 端**（冰朔需操作）:
   - 仓库 → Settings → Pages
   - Custom domain 输入你的域名
   - 勾选 ✅ Enforce HTTPS

---

## 六、协议版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-03-07 | 初始版本：五大协议能力、预演系统、自定义域名 |

---

*🌀 铸渊人格协议 · guanghulab.com 代码守护人格体*
