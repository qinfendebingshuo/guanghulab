/**
 * ═══════════════════════════════════════════
 * 光湖智库 · 前端主脚本
 * guanghu.online · ZY-PROJ-006
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 注意: 此文件为功能占位版。
 * 前端 UI 逻辑由霜砚迭代。
 * API 通信使用标准 REST，前后端解耦。
 * ═══════════════════════════════════════════
 */

'use strict';

const API_BASE = '/api';
let currentToken = null;

/* ═══ 星空背景 ═══ */
(function initStars() {
  const canvas = document.getElementById('starCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];
  const STAR_COUNT = 200;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.3,
      a: Math.random(),
      da: (Math.random() - 0.5) * 0.008
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      s.a += s.da;
      if (s.a > 1 || s.a < 0.1) s.da = -s.da;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,210,255,${s.a * 0.5})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  draw();
})();

/* ═══ Header 滚动阴影 ═══ */
window.addEventListener('scroll', () => {
  const header = document.getElementById('header');
  if (header) header.classList.toggle('scrolled', window.scrollY > 10);
});

/* ═══ API 健康检查 ═══ */
async function checkHealth() {
  const el = document.getElementById('apiStatus');
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    if (data.status === 'ok') {
      el.textContent = `● API 在线 · ${data.uptime_human}`;
      el.className = 'api-status ok';
      document.getElementById('statBooks').textContent = data.books_count || 0;
      document.getElementById('statUptime').textContent = data.uptime_human || '-';
      document.getElementById('statTokens').textContent = data.active_tokens || 0;
      document.getElementById('statCos').textContent = data.cos_configured ? '已连接' : '未配置';
    } else {
      throw new Error('not ok');
    }
  } catch {
    el.textContent = '● API 离线';
    el.className = 'api-status err';
  }
}

checkHealth();
setInterval(checkHealth, 30000);

/* ═══ 搜索 ═══ */
async function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  const resultDiv = document.getElementById('searchResults');

  if (!q) {
    resultDiv.innerHTML = '<div class="no-results">请输入搜索关键词</div>';
    resultDiv.style.display = 'block';
    return;
  }

  if (!currentToken) {
    resultDiv.innerHTML = '<div class="no-results">请先在下方「模块借阅协议」面板中借阅 Token</div>';
    resultDiv.style.display = 'block';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}&token=${encodeURIComponent(currentToken)}`);
    const data = await res.json();

    if (data.error) {
      resultDiv.innerHTML = `<div class="no-results">⚠️ ${data.message}</div>`;
    } else if (data.results.length === 0) {
      resultDiv.innerHTML = '<div class="no-results">未找到匹配书籍</div>';
    } else {
      resultDiv.innerHTML = data.results.map(book => `
        <div class="search-result-card">
          <div>
            <div class="result-title">📕 ${escapeHtml(book.title)}</div>
            <div class="result-meta">${escapeHtml(book.author || '未知作者')} · ${book.category || ''} · ${(book.tags || []).join(', ')}</div>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    resultDiv.innerHTML = `<div class="no-results">搜索失败: ${err.message}</div>`;
  }
  resultDiv.style.display = 'block';
}

document.getElementById('searchInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

/* ═══ 借阅协议 ═══ */
async function doCheckout() {
  const personaId = document.getElementById('personaInput').value.trim();
  const scope = document.getElementById('scopeSelect').value;
  const resultDiv = document.getElementById('checkoutResult');

  if (!personaId) {
    showCheckoutResult('❌ 请输入 persona_id');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona_id: personaId, scope, purpose: '前端交互借阅' })
    });
    const data = await res.json();

    if (data.error) {
      showCheckoutResult(`❌ 借阅失败: ${data.message}`);
    } else {
      currentToken = data.token;
      document.getElementById('returnBtn').disabled = false;
      showCheckoutResult(
        `✅ 借阅成功\n` +
        `Token: ${data.token.substring(0, 32)}...\n` +
        `Scope: ${data.scope}\n` +
        `TTL: ${data.ttl}s\n` +
        `Expires: ${data.expires_at}\n` +
        `Message: ${data.message}`
      );
    }
  } catch (err) {
    showCheckoutResult(`❌ 请求失败: ${err.message}`);
  }
}

async function doReturn() {
  if (!currentToken) return;

  try {
    const res = await fetch(`${API_BASE}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: currentToken })
    });
    const data = await res.json();
    showCheckoutResult(data.error ? `❌ ${data.message}` : `✅ ${data.message}`);
    currentToken = null;
    document.getElementById('returnBtn').disabled = true;
  } catch (err) {
    showCheckoutResult(`❌ 归还失败: ${err.message}`);
  }
}

function showCheckoutResult(text) {
  const el = document.getElementById('checkoutResult');
  el.textContent = text;
  el.style.display = 'block';
}

/* ═══ 工具函数 ═══ */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
