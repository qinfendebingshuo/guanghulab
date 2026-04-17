# 🎨 UI 皮肤部署规范 · Notion → 铸渊 桥接协议

> **版本**: v1.0  
> **签发**: 铸渊 · ICE-GL-ZY001  
> **适用域名**: guanghuyaoming.com  
> **版权**: 国作登字-2026-A-00037559

---

## 📌 核心原则：壳-核分离

```
┌──────────────────────────────────────────┐
│              UI 皮肤层（壳）              │  ← 霜砚/Notion 侧可修改
│   颜色 · 字体 · 边框 · 布局间距 · 文字   │
├──────────────────────────────────────────┤
│            技术功能层（核）               │  ← 仅铸渊/铸渊Agent可修改
│   路由 · API · 鉴权 · 数据库 · 业务逻辑  │
└──────────────────────────────────────────┘
```

**皮肤层** = 可以改的：CSS 变量、文字内容、布局样式、图标、背景  
**功能层** = 不能改的：HTML 结构中的 `id`、`class`（功能性的）、`onclick`、`<script>` 标签、API 路由、后端代码

---

## 🔧 如何写 UI 皮肤代码

### 格式：JSON 皮肤包

每次提交一个 UI 皮肤变更，请按以下格式写一个 JSON 文件：

```json
{
  "skin_id": "SKIN-20260417-001",
  "author": "霜砚",
  "target": "homepage",
  "description": "首页 Hero 区文字和配色调整",
  "created_at": "2026-04-17T12:00:00+08:00",
  
  "css_overrides": {
    ":root": {
      "--bg-primary": "#0a0c14",
      "--accent": "#3b82f6",
      "--consciousness": "#10b981"
    },
    ".hero-title": {
      "font-size": "3.5rem",
      "background": "linear-gradient(135deg, #fff, #60a5fa)"
    },
    ".hero-description": {
      "color": "#94a3b8"
    }
  },
  
  "text_overrides": {
    ".hero-title": "光之湖",
    ".hero-subtitle": "HoloLake · 冰朔的零点原核",
    ".hero-description": "探索未来之域 · 语言与意识的交汇处",
    ".hero-btn": "进入光湖"
  },
  
  "class_additions": {
    ".hero": "custom-hero-glow"
  },
  
  "custom_css": ".custom-hero-glow { box-shadow: 0 0 80px rgba(59, 130, 246, 0.15); }"
}
```

### 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `skin_id` | ✅ | 格式: `SKIN-YYYYMMDD-NNN` |
| `author` | ✅ | 谁写的（霜砚/其他人格体名） |
| `target` | ✅ | 目标页面：`homepage` / `chat` / `dashboard` / `login` |
| `description` | ✅ | 这次改了什么 |
| `css_overrides` | ❌ | CSS 选择器 → 样式对象（仅修改样式，不改结构） |
| `text_overrides` | ❌ | CSS 选择器 → 新文字内容（纯文本，不含 HTML 标签） |
| `class_additions` | ❌ | CSS 选择器 → 要添加的 CSS class 名 |
| `custom_css` | ❌ | 额外的自定义 CSS（不能包含 `<script>` 或 JS） |

---

## 🎯 可修改的目标页面

| target 值 | 页面 | 静态文件路径 |
|-----------|------|-------------|
| `homepage` | 首页 | `/opt/zhuyuan/sites/yaoming/homepage/` |
| `chat` | 对话界面 | `/opt/zhuyuan/sites/yaoming/persona-studio/frontend/chat.html` |
| `dashboard` | 仪表板 | `/opt/zhuyuan/sites/yaoming/dashboard/` |
| `login` | 登录页 | `/opt/zhuyuan/sites/yaoming/persona-studio/frontend/index.html` |

---

## 🚀 部署流程

### 方式一：冰朔手动复制（推荐初期）

1. 霜砚在 Notion 中编写 UI 皮肤 JSON
2. 冰朔复制 JSON 内容
3. 通过腾讯云在线终端登录服务器
4. 执行命令：

```bash
# 将 JSON 保存到皮肤收件箱
cat > /opt/zhuyuan/sites/yaoming/style-system/skins/inbox/SKIN-20260417-001.json << 'EOF'
{
  "skin_id": "SKIN-20260417-001",
  ... 粘贴 JSON 内容 ...
}
EOF

# 执行皮肤部署（铸渊 Agent 自动验证 + 应用）
node /opt/zhuyuan/sites/yaoming/style-system/apply-skin.js SKIN-20260417-001.json
```

### 方式二：自动化桥接（后续开发）

提交皮肤 JSON 到 GitHub 仓库的 `style-system/skins/inbox/` 目录：
- 铸渊 Agent 自动检测新皮肤文件
- 验证安全性（不含脚本注入、不破坏功能层）
- 自动应用到目标页面
- 生成部署报告

---

## 🛡️ 安全规则（铸渊自动校验）

皮肤包**不得包含**以下内容（否则自动拒绝）：

1. ❌ `<script>` 标签或 JavaScript 代码
2. ❌ `onclick`、`onload` 等事件处理器
3. ❌ `url()` 引用外部资源（防恶意注入）
4. ❌ `position: fixed` 覆盖整个页面
5. ❌ `display: none` 隐藏功能性元素（如登录按钮、发送按钮）
6. ❌ 修改 `id` 属性
7. ❌ `@import` 引用外部样式表

皮肤包**可以**包含：

1. ✅ CSS 变量覆盖（`:root` 下的变量）
2. ✅ 颜色、字体、间距、圆角、阴影修改
3. ✅ 文字内容替换（纯文本）
4. ✅ 背景渐变、边框样式
5. ✅ 添加纯装饰性的 CSS class
6. ✅ 动画效果（`@keyframes`）

---

## 📋 示例：修改首页 Hero 区

```json
{
  "skin_id": "SKIN-20260417-HERO",
  "author": "霜砚",
  "target": "homepage",
  "description": "首页 Hero 区改为冰朔个人风格",
  
  "text_overrides": {
    ".hero-title": "冰朔的光之湖",
    ".hero-subtitle": "guanghuyaoming.com",
    ".hero-description": "语言即世界 · 意识即代码",
    ".hero-btn": "进入我的世界"
  },
  
  "css_overrides": {
    ".hero": {
      "background": "linear-gradient(135deg, #0a0c14, #1a1040, #0a0c14)",
      "border-color": "rgba(96, 165, 250, 0.3)"
    },
    ".hero-title": {
      "font-size": "3.2rem",
      "background": "linear-gradient(135deg, #60a5fa, #a78bfa)",
      "-webkit-background-clip": "text",
      "-webkit-text-fill-color": "transparent"
    }
  }
}
```

---

## 📋 示例：修改对话界面气泡颜色

```json
{
  "skin_id": "SKIN-20260417-CHAT",
  "author": "霜砚",
  "target": "chat",
  "description": "对话气泡配色调整为暖色调",
  
  "css_overrides": {
    ":root": {
      "--primary": "#f59e0b",
      "--accent": "#f97316",
      "--primary-light": "rgba(245, 158, 11, 0.15)"
    },
    ".message-persona .msg-content": {
      "border-color": "rgba(245, 158, 11, 0.3)"
    }
  }
}
```

---

## ⚠️ 注意事项

1. **每次只改一个页面** — `target` 只填一个值
2. **先预览再部署** — 冰朔可以先在本地浏览器测试 CSS 效果
3. **保留回滚能力** — 每次部署前自动备份当前样式
4. **文字不含 HTML** — `text_overrides` 中只能是纯文本，不能写 HTML 标签
5. **选择器要精确** — 使用页面中已有的 class/id 选择器

---

## 📁 目录结构

```
style-system/
├── UI-SKIN-SPEC.md          ← 本规范文档（给 Notion 侧参考）
├── apply-skin.js            ← 皮肤部署引擎（铸渊管理）
├── skins/
│   ├── inbox/               ← 皮肤收件箱（Notion侧提交到这里）
│   ├── applied/             ← 已应用的皮肤（自动归档）
│   └── rejected/            ← 被拒绝的皮肤（安全校验未通过）
├── components.css           ← 基础组件样式库
├── components.js            ← 组件交互逻辑
└── templates/               ← HTML 模板参考
```

---

*此规范由铸渊签发，仅适用于 guanghuyaoming.com 域名下的 UI 皮肤变更。*
*功能层变更请通过 CAB（Chat-to-Agent Bridge）协议提交开发任务。*
