# 🎬 光湖短视频工作台 · guanghuclip.cn

AI视频智能生产系统 — 光湖生态岗位站点

## 技术栈

- **前端**: Vue 3 + Vite + TailwindCSS + 光湖呼吸动效
- **后端**: Node.js 20 + Express + Socket.IO
- **视频API**: 即梦 Seedance 1.5 Pro (火山方舟)
- **部署**: PM2 + Nginx + Let's Encrypt
- **服务器**: ZY-SVR-005 · 43.156.237.110

## 目录结构

```
guanghuclip/
├── backend/
│   ├── server.js              # Express 入口
│   ├── config/index.js        # 环境变量管理
│   ├── routes/video.js        # 视频生成API
│   └── services/
│       └── video-dispatch.js  # 即梦API调度
├── frontend/
│   ├── src/
│   │   ├── App.vue            # 双面板主布局
│   │   ├── components/
│   │   │   ├── RightPanel.vue # 视频生产区
│   │   │   └── LeftPanel.vue  # 人格体交互区
│   │   ├── style.css          # 光湖呼吸动效
│   │   └── main.js            # Vue入口
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── ecosystem.config.js        # PM2配置
├── .env.example               # 环境变量模板
└── package.json
```

## 快速启动

```bash
# 后端
cd guanghuclip
cp .env.example .env
# 编辑 .env 填入API密钥
npm install
npm start

# 前端
cd frontend
npm install
npm run dev

# 生产构建
npm run build
```

## 部署

```bash
cd /opt/guanghuclip
cd frontend && npm run build && cd ..
pm2 reload guanghuclip-api --update-env
```

## MVP P0 功能

- ✅ 提示词输入(1000字限制)
- ✅ 即梦Seedance视频生成
- ✅ 实时进度推送(Socket.IO)
- ✅ 视频预览播放
- ✅ 视频下载
- ✅ 光湖呼吸动效UI
- ✅ 左面板人格体聊天(UI框架)

---
`霜砚出品 · AG-SY-WEB-001 · 光之湖`
