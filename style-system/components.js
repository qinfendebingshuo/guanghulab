// HoloLake StyleKit v1.0 · 主题切换 + Toast + 弹窗交互

document.addEventListener('DOMContentLoaded', function() {

    // ========== 1. 主题切换 ==========
    var themeToggle = document.getElementById('theme-toggle');
    var themeLabel = document.getElementById('themeLabel');
    var html = document.documentElement;
    var isDark = true;

    themeToggle.addEventListener('click', function() {
        isDark = !isDark;
        if (isDark) {
            html.setAttribute('data-theme', 'dark');
            themeLabel.textContent = '🌙 深色';
            theme-toggle.classList.remove('active');
        } else {
            html.setAttribute('data-theme', 'light');
            themeLabel.textContent = '☀️ 浅色';
            theme-toggle.classList.add('active');
        }
        showToast('success', '✨ 已切换到' + (isDark ? '深色' : '浅色') + '主题');
    });

// ====== 2. 弹窗交互 =======
// var modalOverlay = document.getElementById('modalOverlay');
// var openBtn = document.getElementById('openModalBtn');
// var closeBtn = document.getElementById('closeModalBtn');
// var cancelBtn = document.getElementById('cancelModalBtn');
// var confirmBtn = document.getElementById('confirmModalBtn');

// function openModal() {
//     modalOverlay.classList.add('open');
// }

// function closeModal() {
//     modalOverlay.classList.remove('open');
// }

// openBtn.addEventListener('click', openModal);
// closeBtn.addEventListener('click', closeModal);
// cancelBtn.addEventListener('click', closeModal);
// confirmBtn.addEventListener('click', function() {
//     closeModal();
//     showToast('success', '已确认！');
// });

// // 点击遮罩层关闭
// modalOverlay.addEventListener('click', function(e) {
//     if (e.target === modalOverlay) closeModal();
// });
    // ========== 3. 卡片点击效果 ==========
    var cards = document.querySelectorAll('.card');
    cards.forEach(function(card) {
        card.addEventListener('click', function() {
            var name = card.querySelector('.card-title').textContent;
            showToast('info', '👆 你点击了人格体「' + name + '」');
        });
    });

    console.log('HoloLake StyleKit v1.0 · 主题切换+Toast+弹窗已加载 ✨');
});

// ========== Toast提示函数（全局） ==========
function showToast(type, message) {
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);

    // 3秒后自动移除
    setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
}
