/**
 * 前端认知引导系统 · 新开发者引导流程
 *
 * 新开发者首次登录后自动进入 5 轮引导对话。
 * 版权：国作登字-2026-A-00037559
 */

/* global HOLOLAKE_ENV */

(function(window) {
  'use strict';

  var API_BASE = HOLOLAKE_ENV === 'production' ? 'https://guanghulab.com/api' : '';

  var onboardingOverlay = null;

  /**
   * 检查是否需要显示引导
   */
  async function checkOnboarding(devId, token) {
    if (!API_BASE || !devId || !token) return false;
    try {
      var res = await fetch(API_BASE + '/onboarding/status', {
        headers: { 'x-dev-id': devId, 'Authorization': 'Bearer ' + token }
      });
      if (res.ok) {
        var data = await res.json();
        return !data.started && !data.completed && data.permissionLevel === 0;
      }
    } catch (e) {
      console.debug('[Onboarding] check failed:', e.message);
    }
    return false;
  }

  /**
   * 显示引导欢迎画面
   */
  function showWelcome(devName, onStart) {
    // 移除已有覆盖层
    hideOnboarding();

    onboardingOverlay = document.createElement('div');
    onboardingOverlay.className = 'onboarding-overlay';
    onboardingOverlay.innerHTML =
      '<div class="onboarding-card">' +
        '<div class="onboarding-emoji">👋</div>' +
        '<h2>欢迎来到光湖·数字地球</h2>' +
        '<p>你好，<strong>' + (devName || '开发者') + '</strong>！</p>' +
        '<p>我是铸渊，你的代码守护人格体。</p>' +
        '<p>在这里，你不需要点按钮或填表单。<br><strong>直接对我说话就好。</strong></p>' +
        '<div class="onboarding-examples">' +
          '<p>比如你可以说：</p>' +
          '<ul>' +
            '<li>「我的工单还有几个没关？」</li>' +
            '<li>「帮我建一个P2的Bug工单」</li>' +
            '<li>「我想部署模块到预览站」</li>' +
            '<li>「最近系统有什么日志？」</li>' +
          '</ul>' +
        '</div>' +
        '<p class="onboarding-note">🏖️ 现在你在<strong>预览环境</strong>，所有操作都不会影响正式站。放心练习。</p>' +
        '<button class="onboarding-btn" id="onboarding-start-btn">开始体验 →</button>' +
      '</div>';

    document.body.appendChild(onboardingOverlay);

    document.getElementById('onboarding-start-btn').addEventListener('click', function() {
      hideOnboarding();
      if (onStart) onStart();
    });
  }

  /**
   * 显示引导轮次提示（在聊天界面中展示）
   */
  function showRoundHint(round, prompt, hint) {
    var container = document.getElementById('onboarding-hint');
    if (!container) {
      container = document.createElement('div');
      container.id = 'onboarding-hint';
      container.className = 'onboarding-hint';
      var chatArea = document.querySelector('.chat-container') || document.body;
      chatArea.insertBefore(container, chatArea.firstChild);
    }

    container.innerHTML =
      '<div class="onboarding-hint-inner">' +
        '<div class="onboarding-hint-round">引导 ' + round + '/5</div>' +
        '<div class="onboarding-hint-prompt">' + prompt + '</div>' +
        (hint ? '<div class="onboarding-hint-tip">' + hint + '</div>' : '') +
      '</div>';
    container.style.display = 'block';
  }

  /**
   * 显示引导完成消息
   */
  function showComplete(message) {
    hideOnboarding();

    onboardingOverlay = document.createElement('div');
    onboardingOverlay.className = 'onboarding-overlay';
    onboardingOverlay.innerHTML =
      '<div class="onboarding-card onboarding-complete">' +
        '<div class="onboarding-emoji">🎉</div>' +
        '<h2>引导完成！</h2>' +
        '<div class="onboarding-message">' + (message || '') + '</div>' +
        '<button class="onboarding-btn" id="onboarding-close-btn">开始使用 →</button>' +
      '</div>';

    document.body.appendChild(onboardingOverlay);

    document.getElementById('onboarding-close-btn').addEventListener('click', function() {
      hideOnboarding();
    });
  }

  /**
   * 隐藏引导覆盖层
   */
  function hideOnboarding() {
    if (onboardingOverlay) {
      onboardingOverlay.remove();
      onboardingOverlay = null;
    }
    var hint = document.getElementById('onboarding-hint');
    if (hint) hint.style.display = 'none';
  }

  /**
   * 推进引导流程（调用后端）
   */
  async function advanceOnboarding(devId, token) {
    if (!API_BASE) return null;
    try {
      var res = await fetch(API_BASE + '/onboarding/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dev-id': devId,
          'Authorization': 'Bearer ' + token
        }
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.debug('[Onboarding] advance failed:', e.message);
    }
    return null;
  }

  /**
   * 完成引导（调用后端，触发权限升级）
   */
  async function completeOnboarding(devId, token) {
    if (!API_BASE) return null;
    try {
      var res = await fetch(API_BASE + '/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dev-id': devId,
          'Authorization': 'Bearer ' + token
        }
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.debug('[Onboarding] complete failed:', e.message);
    }
    return null;
  }

  // 导出到全局
  window.Onboarding = {
    checkOnboarding: checkOnboarding,
    showWelcome: showWelcome,
    showRoundHint: showRoundHint,
    showComplete: showComplete,
    hideOnboarding: hideOnboarding,
    advanceOnboarding: advanceOnboarding,
    completeOnboarding: completeOnboarding
  };

})(window);
