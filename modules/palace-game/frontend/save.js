/**
 * M-PALACE · 存档读档逻辑
 * 列出存档、读取存档、删除存档
 */

(function () {
  'use strict';

  var API_BASE = window.location.origin;

  function init() {
    loadSaveList();
    bindEvents();
  }

  // ---------- Load Save List ----------
  function loadSaveList() {
    var container = document.getElementById('save-list');

    fetch(API_BASE + '/api/palace/save/list')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          container.innerHTML = '<div class="empty-state">获取存档列表失败</div>';
          return;
        }
        renderSaveList(data.saves || []);
      })
      .catch(function () {
        container.innerHTML = '<div class="empty-state">无法连接服务器</div>';
      });
  }

  function renderSaveList(saves) {
    var container = document.getElementById('save-list');

    if (saves.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无存档</div>';
      return;
    }

    container.innerHTML = '';
    saves.forEach(function (save) {
      var item = document.createElement('div');
      item.className = 'save-item fade-in';

      var info = document.createElement('div');
      info.className = 'save-info';

      var idEl = document.createElement('div');
      idEl.className = 'save-id';
      idEl.textContent = save.save_id;

      var detail = document.createElement('div');
      detail.className = 'save-detail';
      var parts = [];
      if (save.dynasty) parts.push(save.dynasty);
      if (save.role) parts.push(save.role);
      if (save.chapter) parts.push('第' + save.chapter + '章');
      if (save.created_at) parts.push(save.created_at.slice(0, 16).replace('T', ' '));
      detail.textContent = parts.join(' · ');

      info.appendChild(idEl);
      info.appendChild(detail);

      var actions = document.createElement('div');
      actions.className = 'save-actions';

      var loadBtn = document.createElement('button');
      loadBtn.className = 'btn btn-small';
      loadBtn.textContent = '读档';
      loadBtn.addEventListener('click', function () {
        doLoad(save.save_id);
      });

      actions.appendChild(loadBtn);

      item.appendChild(info);
      item.appendChild(actions);
      container.appendChild(item);
    });
  }

  // ---------- Load Save ----------
  function doLoad(saveId) {
    fetch(API_BASE + '/api/palace/save/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ save_id: saveId })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          showToast(data.message || '读档失败');
          return;
        }
        sessionStorage.setItem('palace_save_id', saveId);
        sessionStorage.setItem('palace_loaded', JSON.stringify(data));
        window.location.href = 'game.html';
      })
      .catch(function (err) {
        showToast('网络错误：' + err.message);
      });
  }

  // ---------- Events ----------
  function bindEvents() {
    document.getElementById('btn-load').addEventListener('click', function () {
      var id = document.getElementById('load-id').value.trim();
      if (!id) { showToast('请输入存档编号'); return; }
      doLoad(id);
    });

    document.getElementById('load-id').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var id = this.value.trim();
        if (id) doLoad(id);
      }
    });
  }

  // ---------- Utilities ----------
  function showToast(msg) {
    var old = document.querySelector('.toast');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 3000);
  }

  // ---------- Boot ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
