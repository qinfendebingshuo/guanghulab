function toggleFAQ(element) {
    var item = element.parentElement;
    var wasOpen = item.classList.contains('open');
    
    // 关闭所有其他 FAQ
    document.querySelectorAll('.faq-item').forEach(function(el) {
        el.classList.remove('open');
    });
    
    // 如果当前没打开，就打开它
    if (!wasOpen) {
        item.classList.add('open');
    }
}

function filterCategory(category) {
    // 更新导航高亮
    document.querySelectorAll('.nav-item').forEach(function(item) {
        if (item.dataset.category === category) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // 过滤 FAQ 显示
    var items = document.querySelectorAll('.faq-item');
    var visibleCount = 0;
    
    items.forEach(function(item) {
        if (category === 'all' || item.dataset.category === category) {
            item.style.display = 'block';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });
    
    // 显示/隐藏"无结果"提示
    document.getElementById('noResults').style.display = visibleCount === 0 ? 'block' : 'none';
    
    // 清空搜索框
    document.getElementById('searchInput').value = '';
}

function searchFAQ() {
    var query = document.getElementById('searchInput').value.toLowerCase();
    var items = document.querySelectorAll('.faq-item');
    var visibleCount = 0;
    
    // 重置导航为"全部"
    document.querySelectorAll('.nav-item').forEach(function(item) {
        if (item.dataset.category === 'all') {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // 搜索过滤
    items.forEach(function(item) {
        var question = item.querySelector('.faq-question span').textContent.toLowerCase();
        var answer = item.querySelector('.faq-answer').textContent.toLowerCase();
        
        if (question.indexOf(query) !== -1 || answer.indexOf(query) !== -1 || query === '') {
            item.style.display = 'block';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });
    
    // 显示/隐藏"无结果"提示
    document.getElementById('noResults').style.display = visibleCount === 0 ? 'block' : 'none';
}

function submitFeedback() {
    var type = document.getElementById('feedbackType').value;
    var content = document.getElementById('feedbackContent').value;
    
    if (!content.trim()) {
        showToast('请先填写反馈内容 🙏');
        return;
    }
    
    // 这里以后会连接后端 API
    console.log('Feedback submitted:', { type: type, content: content });
    
    // 清空表单
    document.getElementById('feedbackContent').value = '';
    
    showToast('反馈已提交，感谢你！ ✅');
}

function showToast(message) {
    var toast = document.getElementById('submitToast');
    
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'submitToast';
        toast.className = 'submit-toast';
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(function() {
        toast.classList.remove('show');
    }, 2000);
}

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ HoloLake 帮助中心已加载');
});
