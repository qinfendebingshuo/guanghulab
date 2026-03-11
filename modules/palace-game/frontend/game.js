/**
 * M-PALACE · 游戏交互逻辑
 * 管理叙事渲染、选项交互、状态栏更新、存档操作
 */

(function () {
  'use strict';

  var API_BASE = window.location.origin;
  var saveId = sessionStorage.getItem('palace_save_id') || '';
  var choicesMeta = null;
  var isTyping = false;

  // ---------- Initialization ----------
  function init() {
    var startData = sessionStorage.getItem('palace_state');
    var loadedData = sessionStorage.getItem('palace_loaded');

    if (startData) {
      var data = JSON.parse(startData);
      sessionStorage.removeItem('palace_state');
      renderGameData(data);
    } else if (loadedData) {
      var loaded = JSON.parse(loadedData);
      sessionStorage.removeItem('palace_loaded');
      renderLoadedData(loaded);
    } else if (saveId) {
      loadSave(saveId);
    } else {
      window.location.href = 'index.html';
    }

    bindEvents();
  }

  // ---------- Rendering ----------
  function renderGameData(data) {
    saveId = data.save_id || saveId;
    document.getElementById('save-id-display').textContent = '存档号: ' + saveId;

    if (data.state && data.state.player) {
      var p = data.state.player;
      document.getElementById('top-title').textContent =
        '🏯 宫廷纪 · ' + (p.worldview || '') + ' · ' + (p.role || '');
    }

    if (data.narrative) {
      renderNarrative(data.narrative);
    }

    if (data.four_dimensions) {
      updateStatusBar(data.four_dimensions);
    }

    updateProgressInfo(data.chapter || 1, data.paragraph || 1);
  }

  function renderLoadedData(data) {
    document.getElementById('save-id-display').textContent = '存档号: ' + saveId;

    if (data.state) {
      var s = data.state;
      if (s.player) {
        document.getElementById('top-title').textContent =
          '🏯 宫廷纪 · ' + (s.player.worldview || '') + ' · ' + (s.player.role || '');
      }
      if (s.four_dimensions) {
        updateStatusBar(s.four_dimensions);
      }
      updateProgressInfo(s.chapter || 1, s.paragraph || 1);
    }

    // Render last narrative from history or show resume message
    var narrativeEl = document.getElementById('narrative-text');
    narrativeEl.textContent = '存档已恢复。继续你的宫廷故事……';
    renderChoices(['继续前行', '回顾往事', '观察四周']);
  }

  function renderNarrative(narrative) {
    if (narrative.chapter_title) {
      document.getElementById('chapter-title').textContent = narrative.chapter_title;
    }

    var textEl = document.getElementById('narrative-text');
    if (narrative.narrative) {
      typewriter(textEl, narrative.narrative);
    }

    if (narrative.choices && narrative.choices.length > 0) {
      // Delay choices until typewriter finishes
      var delay = narrative.narrative ? narrative.narrative.length * 50 + 500 : 200;
      setTimeout(function () {
        renderChoices(narrative.choices);
      }, delay);
    }

    choicesMeta = narrative.choices_meta || null;
  }

  function renderChoices(choices) {
    var container = document.getElementById('choices-container');
    container.innerHTML = '';

    var nums = ['①', '②', '③'];
    choices.forEach(function (text, i) {
      var btn = document.createElement('button');
      btn.className = 'choice-btn fade-in';
      btn.innerHTML = '<span class="choice-num">' + (nums[i] || '·') + '</span>' + escapeHtml(text);
      btn.addEventListener('click', function () {
        submitChoice(i, text);
      });
      container.appendChild(btn);
    });
  }

  // ---------- Typewriter Effect ----------
  function typewriter(el, text) {
    isTyping = true;
    el.textContent = '';
    var cursor = document.createElement('span');
    cursor.className = 'typewriter-cursor';
    el.appendChild(cursor);

    var i = 0;
    var interval = setInterval(function () {
      if (i < text.length) {
        el.insertBefore(document.createTextNode(text[i]), cursor);
        i++;
      } else {
        clearInterval(interval);
        if (cursor.parentNode) cursor.remove();
        isTyping = false;
      }
    }, 45);
  }

  // ---------- Status Bar ----------
  function updateStatusBar(dims) {
    var keys = ['power', 'status', 'emotion', 'conflict'];
    keys.forEach(function (k) {
      var val = dims[k] != null ? dims[k] : 50;
      var bar = document.getElementById('bar-' + k);
      var valEl = document.getElementById('val-' + k);
      if (bar) bar.style.width = val + '%';
      if (valEl) valEl.textContent = val;
    });
  }

  function updateProgressInfo(chapter, paragraph) {
    var el = document.getElementById('progress-info');
    if (el) el.textContent = '📖 第' + chapter + '章 · 第' + paragraph + '段';
  }

  // ---------- Interactions ----------
  function submitChoice(index, text) {
    if (isTyping) return;
    disableChoices();

    fetch(API_BASE + '/api/palace/interact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        save_id: saveId,
        input: text,
        choice_index: index,
        option_meta: choicesMeta
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          showToast(data.message || '互动失败');
          enableChoices();
          return;
        }
        choicesMeta = data.choices_meta || null;
        if (data.narrative) renderNarrative(data.narrative);
        if (data.four_dimensions) updateStatusBar(data.four_dimensions);
        updateProgressInfo(data.chapter || 1, data.paragraph || 1);
      })
      .catch(function (err) {
        showToast('网络错误：' + err.message);
        enableChoices();
      });
  }

  function submitFreeInput() {
    var input = document.getElementById('free-input');
    var text = input.value.trim();
    if (!text || isTyping) return;
    input.value = '';
    disableChoices();

    fetch(API_BASE + '/api/palace/interact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        save_id: saveId,
        input: text,
        choice_index: null,
        option_meta: choicesMeta
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          showToast(data.message || '互动失败');
          enableChoices();
          return;
        }
        choicesMeta = data.choices_meta || null;
        if (data.narrative) renderNarrative(data.narrative);
        if (data.four_dimensions) updateStatusBar(data.four_dimensions);
        updateProgressInfo(data.chapter || 1, data.paragraph || 1);
      })
      .catch(function (err) {
        showToast('网络错误：' + err.message);
        enableChoices();
      });
  }

  function disableChoices() {
    var btns = document.querySelectorAll('.choice-btn');
    btns.forEach(function (b) { b.disabled = true; b.style.opacity = '0.5'; });
  }

  function enableChoices() {
    var btns = document.querySelectorAll('.choice-btn');
    btns.forEach(function (b) { b.disabled = false; b.style.opacity = '1'; });
  }

  // ---------- Save / Load ----------
  function doSave() {
    fetch(API_BASE + '/api/palace/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ save_id: saveId, state: {}, persona: {}, history: {} })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { showToast(data.message); return; }
        showToast('存档成功：' + data.save_id);
      })
      .catch(function (err) {
        showToast('存档失败：' + err.message);
      });
  }

  function loadSave(id) {
    fetch(API_BASE + '/api/palace/save/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ save_id: id })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          showToast(data.message || '读档失败');
          window.location.href = 'index.html';
          return;
        }
        renderLoadedData(data);
      })
      .catch(function (err) {
        showToast('网络错误：' + err.message);
        window.location.href = 'index.html';
      });
  }

  // ---------- Events ----------
  function bindEvents() {
    document.getElementById('btn-save').addEventListener('click', doSave);

    document.getElementById('btn-free-submit').addEventListener('click', submitFreeInput);

    document.getElementById('free-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submitFreeInput();
    });

    var toggle = document.getElementById('status-toggle');
    var bar = document.getElementById('status-bar');
    toggle.addEventListener('click', function () {
      bar.classList.toggle('collapsed');
      toggle.textContent = bar.classList.contains('collapsed') ? '▶ 状态栏' : '▼ 状态栏';
    });
  }

  // ---------- Utilities ----------
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

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
