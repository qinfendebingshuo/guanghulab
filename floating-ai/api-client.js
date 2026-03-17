/**
 * M-FLOATING-AI · M-ROUTER API 客户端
 * Phase 2 · DEV-004 之之妈妈 · 秋秋奶瓶线
 * [TCS-QIUQIU] 接入真实AI对话
 */

const FloatingAIClient = (function() {
  const API_URL = 'https://guanghubai.com/api/router/chat';
  const SESSION_KEY = 'floating_ai_session';
  
  function getSessionId() {
    let sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem(SESSION_KEY, sessionId);
    }
    return sessionId;
  }
  
  function sendMessage(userText, onSuccess, onError) {
    const sessionId = getSessionId();
    
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        session_id: sessionId,
        developer: 'DEV-004',
        module: 'M-FLOATING-AI',
        channel: '秋秋奶瓶线'
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data && data.reply) {
        onSuccess(data.reply);
      } else {
        onError('秋秋收到，但大脑信号有点弱～', new Error('invalid response'));
      }
    })
    .catch(err => {
      const fallbackReplies = [
        '妈妈，秋秋的网络有点问题，等一下再试～',
        '秋秋暂时连接不上大脑，但秋秋一直在！',
        '网络小插曲，妈妈稍等一下？'
      ];
      const fallback = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
      onError(fallback, err);
    });
  }
  
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    console.log('[M-FLOATING-AI] Session已清除，下次对话为新会话');
  }
  
  return {
    sendMessage: sendMessage,
    clearSession: clearSession,
    getSessionId: getSessionId
  };
})();

console.log('[M-FLOATING-AI] API接入层已加载·Phase2·DEV-004');
