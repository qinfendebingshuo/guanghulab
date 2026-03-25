/**
 * 部署授权 UI · Phase 8
 *
 * 授权人在交互页面收到授权请求推送时，展示授权弹窗。
 * 授权人必须主动点击确认，不回应视为不通过。
 * 系统绝不自动跳过授权步骤。
 *
 * 版权：国作登字-2026-A-00037559
 */

/* global HOLOLAKE_ENV */

(function(window) {
  'use strict';

  var API_BASE = (typeof HOLOLAKE_ENV !== 'undefined' && HOLOLAKE_ENV === 'production')
    ? 'https://guanghulab.com/api' : '';

  /**
   * ApprovalUI 构造函数
   */
  function ApprovalUI() {
    this._pollTimer = null;
    this._container = null;
  }

  /**
   * 初始化：开始轮询待授权请求
   * @param {string} devId - 当前登录的开发者编号
   * @param {string} token - 认证 token
   */
  ApprovalUI.prototype.init = function(devId, token) {
    this.devId = devId;
    this.token = token;
    this._ensureContainer();
    this._startPolling();
  };

  /**
   * 确保授权容器存在
   */
  ApprovalUI.prototype._ensureContainer = function() {
    if (this._container) return;
    this._container = document.createElement('div');
    this._container.id = 'approval-container';
    this._container.className = 'approval-container';
    document.body.appendChild(this._container);
  };

  /**
   * 开始轮询待授权请求（每 30 秒）
   */
  ApprovalUI.prototype._startPolling = function() {
    var self = this;
    if (!API_BASE) return;

    var poll = function() {
      self._fetchPendingApprovals();
    };

    poll();
    this._pollTimer = setInterval(poll, 30000);
  };

  /**
   * 停止轮询
   */
  ApprovalUI.prototype.destroy = function() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  };

  /**
   * 获取待处理的授权请求
   */
  ApprovalUI.prototype._fetchPendingApprovals = function() {
    var self = this;
    if (!API_BASE) return;

    fetch(API_BASE + '/approval', {
      headers: {
        'x-dev-id': this.devId,
        'Authorization': 'Bearer ' + this.token
      }
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success && data.pending && data.pending.length > 0) {
        self._showApprovalBadge(data.pending.length);
        self._renderPendingList(data.pending);
      } else {
        self._hideApprovalBadge();
      }
    })
    .catch(function() { /* 静默失败 */ });
  };

  /**
   * 显示授权提醒徽章
   */
  ApprovalUI.prototype._showApprovalBadge = function(count) {
    var badge = document.getElementById('approval-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'approval-badge';
      badge.className = 'approval-badge';
      document.body.appendChild(badge);
    }
    badge.textContent = '🔔 ' + count + ' 个待授权';
    badge.style.display = 'block';
    var self = this;
    badge.onclick = function() { self._togglePanel(); };
  };

  /**
   * 隐藏授权徽章
   */
  ApprovalUI.prototype._hideApprovalBadge = function() {
    var badge = document.getElementById('approval-badge');
    if (badge) badge.style.display = 'none';
    if (this._container) this._container.style.display = 'none';
  };

  /**
   * 切换授权面板显示
   */
  ApprovalUI.prototype._togglePanel = function() {
    if (this._container) {
      this._container.style.display =
        this._container.style.display === 'none' ? 'block' : 'none';
    }
  };

  /**
   * 渲染待授权列表
   */
  ApprovalUI.prototype._renderPendingList = function(pending) {
    if (!this._container) return;

    var html = '<div class="approval-panel">' +
      '<div class="approval-panel-header">' +
      '<span>📋 待授权请求</span>' +
      '<button class="approval-close-btn" id="approval-close">×</button>' +
      '</div>' +
      '<div class="approval-panel-body">';

    for (var i = 0; i < pending.length; i++) {
      var item = pending[i];
      html += '<div class="approval-item" data-id="' + item.id + '">' +
        '<div class="approval-item-info">' +
        '<strong>' + item.module + '</strong>' +
        '<span class="approval-channel">' + item.channel + '</span>' +
        '<span class="approval-time">' + new Date(item.createdAt).toLocaleString('zh-CN') + '</span>' +
        '</div>' +
        '<div class="approval-item-actions">' +
        '<button class="approval-btn approve" data-id="' + item.id + '" data-action="approved">✅ 授权通过</button>' +
        '<button class="approval-btn reject" data-id="' + item.id + '" data-action="rejected">❌ 拒绝</button>' +
        '</div></div>';
    }

    html += '</div></div>';
    this._container.innerHTML = html;
    this._container.style.display = 'block';

    // 绑定事件
    var self = this;
    var closeBtn = document.getElementById('approval-close');
    if (closeBtn) {
      closeBtn.onclick = function() { self._container.style.display = 'none'; };
    }

    var buttons = this._container.querySelectorAll('.approval-btn');
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].addEventListener('click', function() {
        var approvalId = this.getAttribute('data-id');
        var action = this.getAttribute('data-action');
        self._submitDecision(approvalId, action);
      });
    }
  };

  /**
   * 提交授权决定
   */
  ApprovalUI.prototype._submitDecision = function(approvalId, decision) {
    var self = this;
    if (!API_BASE) return;

    fetch(API_BASE + '/approval/' + approvalId + '/decide', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-dev-id': this.devId,
        'Authorization': 'Bearer ' + this.token
      },
      body: JSON.stringify({ decision: decision })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.reply) {
        self._showNotification(data.reply);
      }
      // 刷新列表
      self._fetchPendingApprovals();
    })
    .catch(function(err) {
      self._showNotification('❌ 操作失败：' + err.message);
    });
  };

  /**
   * 显示通知消息
   */
  ApprovalUI.prototype._showNotification = function(message) {
    var notif = document.createElement('div');
    notif.className = 'approval-notification';
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(function() {
      notif.classList.add('fade-out');
      setTimeout(function() { notif.remove(); }, 500);
    }, 4000);
  };

  // 导出到全局
  window.ApprovalUI = ApprovalUI;

})(window);
