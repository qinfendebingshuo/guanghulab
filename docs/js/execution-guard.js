/**
 * 执行保护 · 前端隔离层 (L1)
 *
 * 当开发者发出一条会触发系统操作的指令后：
 * 1. 输入框立即禁用（不能发新指令）
 * 2. 取消/撤回按钮不存在（从未渲染过，不是隐藏）
 * 3. 界面进入「执行回放」模式
 * 4. 执行完成后才解锁输入框
 *
 * 版权：国作登字-2026-A-00037559
 */

/* global HOLOLAKE_ENV */

(function(window) {
  'use strict';

  var API_BASE = (typeof HOLOLAKE_ENV !== 'undefined' && HOLOLAKE_ENV === 'production')
    ? 'https://guanghulab.com/api' : '';

  /**
   * ExecutionGuard 构造函数
   * @param {Object} chatInterface - 聊天界面接口对象
   */
  function ExecutionGuard(chatInterface) {
    this.chat = chatInterface || {};
    this.locked = false;
    this.executionId = null;
    this._pollTimer = null;
    this._logIndex = 0;
  }

  /**
   * 进入执行保护状态
   */
  ExecutionGuard.prototype.lockExecution = function(executionId) {
    this.locked = true;
    this.executionId = executionId;
    this._logIndex = 0;

    // 1. 禁用输入框
    var input = this.chat.inputField || document.getElementById('chat-input');
    var sendBtn = this.chat.sendButton || document.getElementById('send-btn');

    if (input) {
      input.disabled = true;
      input.placeholder = '⏳ 系统执行中…请等待完成';
      input.classList.add('execution-locked');
    }
    if (sendBtn) {
      sendBtn.disabled = true;
    }

    // 2. 显示执行状态条
    this._showStatusBar('🔄', '指令已接收，系统正在执行…', 'blue');

    // 3. 开始轮询执行状态
    this._pollExecutionStatus(executionId);
  };

  /**
   * 轮询执行状态
   */
  ExecutionGuard.prototype._pollExecutionStatus = function(executionId) {
    var self = this;

    var poll = function() {
      if (!self.locked) return;
      if (!API_BASE) {
        // 无后端时模拟完成
        setTimeout(function() { self.unlockExecution({ reply: '（本地模式：执行模拟完成）' }); }, 2000);
        return;
      }

      var ctrl = new AbortController();
      var tid = setTimeout(function() { ctrl.abort(); }, 10000);

      fetch(API_BASE + '/execution/' + executionId + '/status?after=' + self._logIndex, {
        signal: ctrl.signal
      })
      .then(function(res) { clearTimeout(tid); return res.json(); })
      .then(function(status) {
        // 更新进度
        self._updateProgressBar(status.progress || 0);

        // 展示新日志
        if (status.newLogs && status.newLogs.length > 0) {
          for (var i = 0; i < status.newLogs.length; i++) {
            self._appendLogEntry(status.newLogs[i]);
          }
          self._logIndex += status.newLogs.length;
        }

        if (status.state === 'completed') {
          self.unlockExecution(status.result || {});
        } else if (status.state === 'failed' || status.state === 'timeout') {
          self.handleExecutionFailure(status.error || { message: '执行失败' });
        } else {
          self._pollTimer = setTimeout(poll, 2000);
        }
      })
      .catch(function() {
        clearTimeout(tid);
        // 网络错误不中断执行，继续轮询
        self._pollTimer = setTimeout(poll, 5000);
      });
    };

    poll();
  };

  /**
   * 执行完成，解锁界面
   */
  ExecutionGuard.prototype.unlockExecution = function(result) {
    this.locked = false;
    this.executionId = null;
    if (this._pollTimer) { clearTimeout(this._pollTimer); this._pollTimer = null; }

    // 恢复输入框
    var input = this.chat.inputField || document.getElementById('chat-input');
    var sendBtn = this.chat.sendButton || document.getElementById('send-btn');

    if (input) {
      input.disabled = false;
      input.placeholder = '和铸渊说话…';
      input.classList.remove('execution-locked');
    }
    if (sendBtn) {
      sendBtn.disabled = false;
    }

    // 更新状态条
    this._showStatusBar('✅', '执行完成', 'green');
    var self = this;
    setTimeout(function() { self._hideStatusBar(); }, 5000);

    // 展示结果
    if (result && result.reply && this.chat.appendMessage) {
      this.chat.appendMessage({ role: 'assistant', content: result.reply });
    }
  };

  /**
   * 执行失败处理
   */
  ExecutionGuard.prototype.handleExecutionFailure = function(error) {
    this.locked = false;
    this.executionId = null;
    if (this._pollTimer) { clearTimeout(this._pollTimer); this._pollTimer = null; }

    var input = this.chat.inputField || document.getElementById('chat-input');
    var sendBtn = this.chat.sendButton || document.getElementById('send-btn');

    if (input) {
      input.disabled = false;
      input.placeholder = '和铸渊说话…';
      input.classList.remove('execution-locked');
    }
    if (sendBtn) {
      sendBtn.disabled = false;
    }

    this._showStatusBar('❌', '执行失败 · 系统已自动回滚到执行前状态', 'red');
    var self = this;
    setTimeout(function() { self._hideStatusBar(); }, 10000);

    var msg = error && error.message ? error.message : '未知错误';
    if (this.chat.appendMessage) {
      this.chat.appendMessage({
        role: 'assistant',
        content: '❌ 操作执行失败：' + msg +
                 '\n\n系统已自动回滚到执行前的状态。没有任何数据被修改。\n' +
                 '你可以重新描述你想做的事，或者说「发生了什么」来查看详细日志。'
      });
    }
  };

  /**
   * 拦截浏览器关闭/刷新
   */
  ExecutionGuard.prototype.setupBrowserGuard = function() {
    var self = this;
    window.addEventListener('beforeunload', function(e) {
      if (self.locked) {
        e.preventDefault();
        e.returnValue = '⚠️ 系统正在执行操作，关闭页面不会中断执行，但你将无法看到执行结果。';
        return e.returnValue;
      }
    });
  };

  // ====== 内部 UI 辅助方法 ======

  ExecutionGuard.prototype._showStatusBar = function(icon, text, color) {
    var bar = document.getElementById('execution-status-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'execution-status-bar';
      bar.className = 'execution-status-bar';
      var chatArea = document.querySelector('.chat-messages') || document.querySelector('.chat-container') || document.body;
      chatArea.appendChild(bar);
    }
    bar.className = 'execution-status-bar ' + (color || 'blue');
    bar.innerHTML = '<span class="exec-icon">' + icon + '</span> <span class="exec-text">' + text + '</span>' +
                    '<div class="execution-progress"><div class="execution-progress-fill" id="exec-progress-fill" style="width:5%"></div></div>';
    bar.style.display = 'flex';
    // 注意：没有取消按钮。这不是遗漏，是设计。
  };

  ExecutionGuard.prototype._hideStatusBar = function() {
    var bar = document.getElementById('execution-status-bar');
    if (bar) bar.style.display = 'none';
  };

  ExecutionGuard.prototype._updateProgressBar = function(percent) {
    var fill = document.getElementById('exec-progress-fill');
    if (fill) fill.style.width = Math.max(5, Math.min(100, percent)) + '%';
  };

  ExecutionGuard.prototype._appendLogEntry = function(log) {
    var container = document.getElementById('execution-log-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'execution-log-container';
      container.className = 'execution-log-container';
      var bar = document.getElementById('execution-status-bar');
      if (bar && bar.parentNode) {
        bar.parentNode.insertBefore(container, bar.nextSibling);
      } else {
        (document.querySelector('.chat-messages') || document.body).appendChild(container);
      }
    }
    var entry = document.createElement('div');
    entry.className = 'execution-log-entry';
    var icon = log.success ? '✅' : '⏳';
    var time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString('zh-CN') : '';
    entry.innerHTML = '<span class="log-icon">' + icon + '</span>' +
                      '<span class="log-msg">' + (log.message || '') + '</span>' +
                      '<span class="log-time">' + time + '</span>';
    container.appendChild(entry);
  };

  // 导出到全局
  window.ExecutionGuard = ExecutionGuard;

})(window);
