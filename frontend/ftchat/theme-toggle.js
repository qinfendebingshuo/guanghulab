/* ═══════════════════════════════════════════════════════════
 * 主题切换 + 星空动态背景
 * 守护: 铸渊 · ICE-GL-ZY001
 * ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var THEME_KEY = 'ftchat_theme';
  var body = document.body;
  var toggleBtn = document.getElementById('themeToggle');
  var canvas = document.getElementById('starfield');
  var ctx = canvas.getContext('2d');

  // ── 初始化主题 ──
  function applyTheme(theme) {
    body.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (_e) { /* ignore */ }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a0e27' : '#f5f7fc');
  }
  var savedTheme = null;
  try { savedTheme = localStorage.getItem(THEME_KEY); } catch (_e) { /* ignore */ }
  if (!savedTheme) {
    savedTheme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }
  applyTheme(savedTheme);

  toggleBtn.addEventListener('click', function () {
    var cur = body.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });

  // ─── 星空粒子动画 ───
  var stars = [];
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var width = 0, height = 0;
  var isMobile = window.innerWidth <= 768;
  var STAR_COUNT = isMobile ? 40 : 90;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.4 + 0.3,
      vx: (Math.random() - 0.5) * 0.08,
      vy: (Math.random() - 0.5) * 0.08,
      tw: Math.random() * Math.PI * 2  // twinkle phase
    };
  }

  function init() {
    resize();
    stars = [];
    for (var i = 0; i < STAR_COUNT; i++) stars.push(spawn());
  }

  var lastFrame = 0;
  var FRAME_BUDGET = 1000 / 30; // 30fps，省电

  function tick(ts) {
    if (ts - lastFrame < FRAME_BUDGET) {
      requestAnimationFrame(tick);
      return;
    }
    lastFrame = ts;

    ctx.clearRect(0, 0, width, height);

    var theme = body.getAttribute('data-theme');
    var baseColor = theme === 'dark' ? '255, 255, 255' : '126, 140, 224';

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.x += s.vx; s.y += s.vy; s.tw += 0.02;
      // 边界回绕
      if (s.x < 0) s.x = width;
      if (s.x > width) s.x = 0;
      if (s.y < 0) s.y = height;
      if (s.y > height) s.y = 0;

      var alpha = (Math.sin(s.tw) * 0.4 + 0.6) * (theme === 'dark' ? 0.8 : 0.35);
      ctx.fillStyle = 'rgba(' + baseColor + ',' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(tick);
  }

  init();
  requestAnimationFrame(tick);

  // 窗口尺寸变化
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      isMobile = window.innerWidth <= 768;
      var newCount = isMobile ? 40 : 90;
      if (newCount !== STAR_COUNT) {
        STAR_COUNT = newCount;
        init();
      } else {
        resize();
      }
    }, 200);
  });
})();
