/**
 * app-shell.js
 * HoloLake 前端统一集成壳
 * 开发者：DEV-010 桔子
 * 功能：全局路由 + 模块加载 + 导航管理
 */
(function() {
  'use strict';

  var modules = [];
  var currentModule = null;

  // === 加载模块注册表 ===
  async function loadRegistry() {
    try {
      var resp = await fetch('./module-registry.json');
      modules = await resp.json();
      console.log('[AppShell] 注册表加载成功，共' + modules.length + '个模块');
      renderNavModules();
      renderModuleGrid();
    } catch (err) {
      console.error('[AppShell] 注册表加载失败：', err);
    }
  }

  // === 渲染导航栏模块按钮 ===
  function renderNavModules() {
    var nav = document.getElementById('navModules');
    if (!nav) return;
    var html = '';
    modules.forEach(function(m) {
      html += '<button class="nav-module-btn" data-module-id="' + m.id + '" title="' + m.name + '">';
      html += m.icon + ' ' + m.name;
      html += '</button>';
    });
    nav.innerHTML = html;

    // 绑定点击事件
    nav.querySelectorAll('.nav-module-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = this.getAttribute('data-module-id');
        loadModule(id);
      });
    });
  }

  // === 渲染欢迎页模块网格 ===
  function renderModuleGrid() {
    var grid = document.getElementById('moduleGrid');
    if (!grid) return;
    var html = '';
    modules.forEach(function(m) {
      html += '<div class="grid-card" data-module-id="' + m.id + '">';
      html += '<span class="grid-icon">' + m.icon + '</span>';
      html += '<span class="grid-name">' + m.name + '</span>';
      html += '<span class="grid-id">' + m.id + '</span>';
      html += '</div>';
    });
    grid.innerHTML = html;

    grid.querySelectorAll('.grid-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var id = this.getAttribute('data-module-id');
        loadModule(id);
      });
    });
  }

  // === 加载模块 ===
  function loadModule(moduleId) {
    var m = modules.find(function(x) { return x.id === moduleId; });
    if (!m) return;

    // 显示加载动画
    var loading = document.getElementById('loadingOverlay');
    var frame = document.getElementById('moduleFrame');
    var welcome = document.getElementById('welcomeScreen');

    loading.style.display = 'flex';
    welcome.style.display = 'none';

    // 加载模块到 iframe
    frame.onload = function() {
      loading.style.display = 'none';
      frame.style.display = 'block';
      updateStatusBar(m);
      console.log('[AppShell] ✅ 模块加载完成: ' + m.id + ' ' + m.name);
    };
    frame.src = m.path;
    currentModule = m;

    // 更新导航栏高亮
    document.querySelectorAll('.nav-module-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-module-id') === moduleId);
    });

    // 更新 hash
    window.location.hash = '#' + moduleId;
  }

  // === 回到首页 ===
  function goHome() {
    var frame = document.getElementById('moduleFrame');
    var welcome = document.getElementById('welcomeScreen');
    var loading = document.getElementById('loadingOverlay');

    frame.style.display = 'none';
    frame.src = '';
    welcome.style.display = 'block';
    loading.style.display = 'none';
    currentModule = null;
    window.location.hash = '';

    document.querySelectorAll('.nav-module-btn').forEach(function(btn) {
      btn.classList.remove('active');
    });
    updateStatusBar(null);
  }

  // === 更新状态栏 ===
  function updateStatusBar(m) {
    var text = document.querySelector('.status-text');
    if (text) {
      text.textContent = m ? '● ' + m.id + ' ' + m.name + ' 已加载' : '系统就绪';
    }
  }

  // === hash 路由 ===
  function handleHashChange() {
    var hash = window.location.hash.replace('#', '');
    if (hash && modules.length > 0) {
      loadModule(hash);
    } else {
      goHome();
    }
  }

  // === 初始化 ===
  document.addEventListener('DOMContentLoaded', async function() {
    console.log('[AppShell] HoloLake 集成壳启动...');
    await loadRegistry();

    document.getElementById('btnHome').addEventListener('click', goHome);

    // 读取初始 hash
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    console.log('[AppShell] 集成壳初始化完成');
  });

})();
