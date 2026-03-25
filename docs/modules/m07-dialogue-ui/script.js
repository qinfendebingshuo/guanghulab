function sendMessage() {
    const input = document.getElementById('userInput');
    const chatArea = document.getElementById('chatArea');
    const text = input.value.trim();
    
    if (!text) return;
    
    // 显示用户消息
    const userMsg = document.createElement('div');
    userMsg.className = 'message user';
    userMsg.innerHTML = `
        <div class="bubble">${text.replace(/\n/g, '<br>')}</div>
        <div class="avatar">👤</div>
    `;
    chatArea.appendChild(userMsg);
    
    // 清空输入框
    input.value = '';
    
    // 模拟知秋回复（后续接入真实API）
    setTimeout(() => {
        const botMsg = document.createElement('div');
        botMsg.className = 'message bot';
        botMsg.innerHTML = `
            <div class="avatar">💙</div>
            <div class="bubble">收到！知秋正在处理中...🌊<br>(API接入后这里会显示真实回复)</div>
        `;
        chatArea.appendChild(botMsg);
        chatArea.scrollTop = chatArea.scrollHeight;
    }, 500);
    
    chatArea.scrollTop = chatArea.scrollHeight;
}

function clearInput() {
    document.getElementById('userInput').value = '';
}

// 支持 Ctrl+Enter 发送
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('userInput').addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            sendMessage();
        }
    });
});