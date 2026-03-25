/**
 * auth.js — 团队登录前端逻辑
 *
 * 开发者编号免配置登录：
 * 1. 选择/输入开发者编号（如 DEV-002）
 * 2. 后端验证编号 → 返回会话 token
 * 3. 自动绑定团队 API → 直接进入对话
 * 4. 不需要手动输入任何 API Key
 *
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var TeamAuth = (function() {

  /**
   * 团队登录 — 开发者编号直接进
   * @param {string} devId - 开发者编号（如 DEV-002）
   * @returns {Promise<Object>} 登录结果
   */
  async function teamLogin(devId) {
    try {
      var response = await fetch('/api/auth/team-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devId: devId })
      });

      var data = await response.json();

      if (data.success) {
        // 存储会话 token（sessionStorage，关闭标签页即清除）
        sessionStorage.setItem('team_session_token', data.sessionToken);
        localStorage.setItem('team_dev_id', devId);
        localStorage.setItem('team_dev_name', data.devName);
        localStorage.setItem('team_dev_level', String(data.level));
        localStorage.setItem('team_dev_channel', data.channel);
        // API Key 不存前端，后端代理所有 API 调用

        return { success: true, data: data };
      } else {
        return { success: false, message: data.message || '开发者编号不存在，请检查。' };
      }
    } catch (err) {
      return { success: false, message: '连接失败，请稍后重试。' };
    }
  }

  /**
   * 验证当前会话
   * @returns {Promise<Object>}
   */
  async function verifySession() {
    var token = sessionStorage.getItem('team_session_token');
    if (!token) return { valid: false };

    try {
      var response = await fetch('/api/auth/verify', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      return await response.json();
    } catch (err) {
      return { valid: false };
    }
  }

  /**
   * 注销
   */
  async function logout() {
    var token = sessionStorage.getItem('team_session_token');
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token }
        });
      } catch (err) {
        // 静默失败
      }
    }
    sessionStorage.removeItem('team_session_token');
    localStorage.removeItem('team_dev_id');
    localStorage.removeItem('team_dev_name');
    localStorage.removeItem('team_dev_level');
    localStorage.removeItem('team_dev_channel');
  }

  /**
   * 获取当前会话 token（用于 API 请求头）
   * @returns {string|null}
   */
  function getSessionToken() {
    return sessionStorage.getItem('team_session_token') || null;
  }

  /**
   * 获取已登录的开发者信息
   * @returns {Object|null}
   */
  function getDevInfo() {
    var devId = localStorage.getItem('team_dev_id');
    if (!devId) return null;
    return {
      devId: devId,
      name: localStorage.getItem('team_dev_name') || '',
      level: parseInt(localStorage.getItem('team_dev_level') || '0', 10),
      channel: localStorage.getItem('team_dev_channel') || ''
    };
  }

  return {
    teamLogin: teamLogin,
    verifySession: verifySession,
    logout: logout,
    getSessionToken: getSessionToken,
    getDevInfo: getDevInfo
  };

})();
