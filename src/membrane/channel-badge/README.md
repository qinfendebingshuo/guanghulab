# 频道徽章 · Channel Badge

光湖编号体系前端通用组件 (Phase 1 只读模式).

## 角色

每个 ZY-FN 前端必须在页面右上角挂载本组件, 显示:

```
[ ZY-SVR-006 / ZY-FN-0007 · 微调模型聊天 ▾ ]
```

点击展开下拉, 列出本服务器上所有已登记的 ZY-FN. Phase 1 选中后弹 toast
"切换将在 Phase 2 启用", 不真正切换. Phase 2 时改成调用
`POST /__switch/activate`.

## 使用

```html
<script type="module">
  import { mountChannelBadge } from '/channel-badge/index.js';
  mountChannelBadge({ currentFn: 'ZY-FN-0007' });
</script>
```

部署时通过 nginx 把 `/channel-badge/` 路径映射到本目录:

```nginx
location /channel-badge/ {
  alias /opt/guanghu/_shared/channel-badge/;
}
```

或者由各 ZY-FN 的部署 workflow 把本文件复制到自己的静态资源目录.

## 数据来源

`GET /__switch/manifest` (由 nginx 反代到 channel-switcher@127.0.0.1:39000).

## 依赖

零依赖. 纯浏览器原生 ES module + DOM API.

## 守护

铸渊 · ICE-GL-ZY001 · 国作登字-2026-A-00037559
