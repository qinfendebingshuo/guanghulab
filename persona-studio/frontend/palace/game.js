/**
 * M-PALACE · AI 驱动游戏交互逻辑
 * 使用用户提供的 AI 模型生成宫廷叙事
 */

(function () {
  'use strict';

  var API_BASE = sessionStorage.getItem('user_api_base') || '';
  var API_KEY = sessionStorage.getItem('user_api_key') || '';
  var MODEL = sessionStorage.getItem('selected_model') || '';

  var gameState = null;
  var isTyping = false;

  // ---------- Initialization ----------
  function init() {
    if (!API_KEY || !MODEL) {
      window.location.href = 'index.html';
      return;
    }

    var stateStr = sessionStorage.getItem('palace_game_state');
    if (!stateStr) {
      window.location.href = 'index.html';
      return;
    }

    try {
      gameState = JSON.parse(stateStr);
    } catch (_e) {
      window.location.href = 'index.html';
      return;
    }

    document.getElementById('model-display').textContent = '模型: ' + MODEL;
    document.getElementById('top-title').textContent =
      '🏯 宫廷纪 · ' + (gameState.worldview || '') + ' · ' + (gameState.role || '');

    if (gameState.current) {
      renderGameData(gameState.current);
    }

    updateProgressInfo(gameState.chapter || 1, gameState.paragraph || 1);
    bindEvents();
  }

  // ---------- Rendering ----------
  function renderGameData(data) {
    if (data.chapter_title) {
      document.getElementById('chapter-title').textContent = data.chapter_title;
    }

    if (data.narrative) {
      typewriter(document.getElementById('narrative-text'), data.narrative);
    }

    if (data.choices && data.choices.length > 0) {
      var delay = data.narrative ? Math.min(data.narrative.length * 45 + 500, 8000) : 200;
      setTimeout(function () {
        renderChoices(data.choices);
      }, delay);
    }

    if (data.four_dimensions) {
      updateStatusBar(data.four_dimensions);
    }
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
        submitChoice(text);
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
      val = Math.max(0, Math.min(100, val));
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

  // ---------- AI Interactions ----------
  function submitChoice(text) {
    if (isTyping) return;
    disableChoices();
    showLoading();

    var userMsg = '玩家选择：' + text + '\n\n请根据玩家的选择，继续推进剧情。生成下一段叙事、新的3个选项、更新四维数值。仅输出 JSON。';

    gameState.history.push({ role: 'user', content: userMsg });

    // Keep history manageable (system + last 10 exchanges)
    var trimmedHistory = trimHistory(gameState.history);

    callAI(trimmedHistory)
      .then(function (data) {
        gameState.history.push({ role: 'assistant', content: JSON.stringify(data) });
        gameState.paragraph = (gameState.paragraph || 1) + 1;

        if (gameState.paragraph > 5) {
          gameState.chapter = (gameState.chapter || 1) + 1;
          gameState.paragraph = 1;
        }

        gameState.current = data;
        sessionStorage.setItem('palace_game_state', JSON.stringify(gameState));

        renderGameData(data);
        updateProgressInfo(gameState.chapter, gameState.paragraph);
      })
      .catch(function (err) {
        showToast('叙事生成失败：' + err.message);
        enableChoices();
      });
  }

  function submitFreeInput() {
    var input = document.getElementById('free-input');
    var text = input.value.trim();
    if (!text || isTyping) return;
    input.value = '';
    submitChoice(text);
  }

  function trimHistory(history) {
    if (history.length <= 12) return history.slice();
    // Keep system prompt + last 10 messages
    return [history[0]].concat(history.slice(-10));
  }

  function callAI(messages) {
    return fetch(API_BASE + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        temperature: 0.9
      })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('AI 模型调用失败 (' + r.status + ')');
        return r.json();
      })
      .then(function (resp) {
        var content = (resp.choices && resp.choices[0] && resp.choices[0].message && resp.choices[0].message.content) || '';
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        return JSON.parse(content);
      });
  }

  // ---------- UI Helpers ----------
  function disableChoices() {
    var btns = document.querySelectorAll('.choice-btn');
    btns.forEach(function (b) { b.disabled = true; b.style.opacity = '0.5'; });
    document.getElementById('btn-free-submit').disabled = true;
  }

  function enableChoices() {
    var btns = document.querySelectorAll('.choice-btn');
    btns.forEach(function (b) { b.disabled = false; b.style.opacity = '1'; });
    document.getElementById('btn-free-submit').disabled = false;
  }

  function showLoading() {
    var textEl = document.getElementById('narrative-text');
    textEl.innerHTML = '<span class="loading"><span class="loading-dot"></span><span class="loading-dot"></span><span class="loading-dot"></span></span>';
    document.getElementById('choices-container').innerHTML = '';
  }

  // ---------- Events ----------
  function bindEvents() {
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
