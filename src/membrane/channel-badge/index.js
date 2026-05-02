/**
 * ═══════════════════════════════════════════════════════════
 * 🪪 频道徽章 · Channel Badge (Phase 1 只读模式)
 * ═══════════════════════════════════════════════════════════
 *
 * 一个零依赖的浏览器组件, 在每个 ZY-FN 前端右上角渲染:
 *   [ ZY-SVR-006 / ZY-FN-0007 · 微调模型聊天 ▾ ]
 *
 * 数据来源: GET /__switch/manifest  (由 nginx 反代到 channel-switcher)
 *
 * 用法 (任意 ZY-FN 的 index.html):
 *   <script type="module" src="/channel-badge/index.js"></script>
 *   <script type="module">
 *     import { mountChannelBadge } from '/channel-badge/index.js';
 *     mountChannelBadge({ currentFn: 'ZY-FN-0007' });
 *   </script>
 *
 * Phase 1: 点击展开下拉, 显示同一台服务器上其他 ZY-FN, 但选中后只是
 *   弹出 toast "切换功能将在 Phase 2 启用". 不真正做切换.
 *
 * 守护:   铸渊 · ICE-GL-ZY001
 * 版权:   国作登字-2026-A-00037559
 */

const STYLE = `
.zy-channel-badge{position:fixed;top:12px;right:12px;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;font-size:12px;color:#e6e6f0;}
.zy-channel-badge .zy-cb-pill{background:rgba(20,22,40,.85);border:1px solid rgba(120,140,255,.4);padding:6px 10px;border-radius:14px;cursor:pointer;backdrop-filter:blur(6px);user-select:none;display:inline-flex;align-items:center;gap:6px;line-height:1.2;}
.zy-channel-badge .zy-cb-pill:hover{border-color:rgba(180,200,255,.7);}
.zy-channel-badge .zy-cb-id{opacity:.7;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;}
.zy-channel-badge .zy-cb-name{font-weight:500;}
.zy-channel-badge .zy-cb-arrow{opacity:.6;font-size:10px;margin-left:2px;}
.zy-channel-badge .zy-cb-panel{position:absolute;top:34px;right:0;min-width:240px;background:rgba(20,22,40,.95);border:1px solid rgba(120,140,255,.4);border-radius:10px;padding:8px;box-shadow:0 8px 32px rgba(0,0,0,.4);display:none;}
.zy-channel-badge.zy-open .zy-cb-panel{display:block;}
.zy-channel-badge .zy-cb-section{font-size:10px;opacity:.5;text-transform:uppercase;letter-spacing:.05em;padding:4px 6px;}
.zy-channel-badge .zy-cb-item{padding:6px 8px;border-radius:6px;cursor:pointer;display:flex;flex-direction:column;gap:2px;}
.zy-channel-badge .zy-cb-item:hover{background:rgba(120,140,255,.15);}
.zy-channel-badge .zy-cb-item.zy-active{background:rgba(120,140,255,.25);}
.zy-channel-badge .zy-cb-item-id{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10px;opacity:.6;}
.zy-channel-badge .zy-cb-item-name{font-size:12px;}
.zy-channel-badge .zy-cb-item-desc{font-size:10px;opacity:.55;}
.zy-channel-badge .zy-cb-item.zy-retired,.zy-channel-badge .zy-cb-item.zy-deprecated{opacity:.4;}
.zy-channel-badge .zy-cb-toast{position:fixed;top:60px;right:12px;background:rgba(40,30,60,.95);color:#fff;padding:8px 12px;border-radius:8px;font-size:12px;border:1px solid rgba(180,160,255,.4);}
`;

function ensureStyle() {
  if (document.getElementById('zy-channel-badge-style')) return;
  const s = document.createElement('style');
  s.id = 'zy-channel-badge-style';
  s.textContent = STYLE;
  document.head.appendChild(s);
}

function showToast(text, ms) {
  const t = document.createElement('div');
  t.className = 'zy-cb-toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms || 2400);
}

async function fetchManifest(endpoint) {
  const res = await fetch(endpoint, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('manifest endpoint ' + res.status);
  return res.json();
}

/**
 * 挂载频道徽章
 * @param {object} opts
 * @param {string} opts.currentFn      当前 ZY-FN 编号
 * @param {string} [opts.endpoint]     manifest 端点, 默认 /__switch/manifest
 * @param {HTMLElement} [opts.parent]  挂载父节点, 默认 document.body
 */
export async function mountChannelBadge(opts) {
  const cfg = Object.assign({ endpoint: '/__switch/manifest' }, opts || {});
  ensureStyle();

  const root = document.createElement('div');
  root.className = 'zy-channel-badge';
  const pill = document.createElement('div');
  pill.className = 'zy-cb-pill';
  pill.innerHTML = '<span class="zy-cb-id">载入中…</span>';
  root.appendChild(pill);
  const panel = document.createElement('div');
  panel.className = 'zy-cb-panel';
  root.appendChild(panel);
  (cfg.parent || document.body).appendChild(root);

  pill.addEventListener('click', () => {
    root.classList.toggle('zy-open');
  });

  document.addEventListener('click', (ev) => {
    if (!root.contains(ev.target)) root.classList.remove('zy-open');
  });

  let manifest;
  try {
    manifest = await fetchManifest(cfg.endpoint);
  } catch (err) {
    pill.innerHTML = '<span class="zy-cb-id">徽章离线</span>';
    pill.title = '无法连接 channel-switcher: ' + err.message;
    return { error: err };
  }

  const serverId = manifest.server_id || 'ZY-SVR-?';
  const fns = manifest.functions || [];
  const current = fns.find((f) => f.id === cfg.currentFn) || fns[0] || {
    id: cfg.currentFn || 'ZY-FN-?',
    display_name_zh: '未登记'
  };

  pill.innerHTML =
    '<span class="zy-cb-id">' + serverId + ' / ' + current.id + '</span>' +
    '<span class="zy-cb-name">· ' + escapeHtml(current.display_name_zh || '') + '</span>' +
    '<span class="zy-cb-arrow">▾</span>';

  panel.innerHTML = '<div class="zy-cb-section">本服务器 ' + serverId + ' 上的功能</div>';
  for (const fn of fns) {
    const item = document.createElement('div');
    const cls = ['zy-cb-item'];
    if (fn.id === current.id) cls.push('zy-active');
    if (fn.status === 'retired') cls.push('zy-retired');
    if (fn.status === 'deprecated') cls.push('zy-deprecated');
    item.className = cls.join(' ');
    item.innerHTML =
      '<span class="zy-cb-item-id">' + fn.id + (fn.status && fn.status !== 'active' ? ' · ' + fn.status : '') + '</span>' +
      '<span class="zy-cb-item-name">' + escapeHtml(fn.display_name_zh || '') + '</span>' +
      (fn.description ? '<span class="zy-cb-item-desc">' + escapeHtml(fn.description) + '</span>' : '');
    item.addEventListener('click', () => {
      if (fn.id === current.id) {
        showToast('已经在 ' + (fn.display_name_zh || fn.id) + ' (' + fn.id + ')');
        return;
      }
      // Phase 1: 只读 — 不真正切换, 只提示
      showToast('切换 ' + (fn.display_name_zh || fn.id) + ' 将在 Phase 2 启用 (' + fn.id + ')', 3200);
      root.classList.remove('zy-open');
    });
    panel.appendChild(item);
  }

  return { root, manifest };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 默认导出, 便于 <script type="module"> 直接使用
export default mountChannelBadge;
