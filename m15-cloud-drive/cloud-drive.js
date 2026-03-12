document.addEventListener('DOMContentLoaded', function() {
    // 文件夹切换
    const folders = document.querySelectorAll('.folder');
    folders.forEach(folder => {
        folder.addEventListener('click', function() {
            folders.forEach(f => f.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // 文件选中
    const fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        item.addEventListener('click', function(e) {
            if (e.target.type === 'checkbox' || e.target.closest('.icon-btn')) return;
            this.classList.toggle('selected');
            const cb = this.querySelector('input[type="checkbox"]');
            if (cb) cb.checked = !cb.checked;
            updateCount();
        });
    });

    // 上传区域显隐
    var uploadBtn = document.getElementById('uploadBtn');
    var uploadZone = document.getElementById('uploadZone');
    if (uploadBtn && uploadZone) {
        uploadBtn.addEventListener('click', function() {
            uploadZone.classList.toggle('visible');
        });
    }

    // 拖拽效果
    if (uploadZone) {
        document.addEventListener('dragover', function(e) {
            e.preventDefault();
            uploadZone.classList.add('visible');
            uploadZone.classList.add('dragover');
        });
        document.addEventListener('dragleave', function(e) {
            if (!e.relatedTarget) uploadZone.classList.remove('dragover');
        });
        document.addEventListener('drop', function(e) {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
        });
    }

    // 选中计数
    function updateCount() {
        var n = document.querySelectorAll('.file-item.selected').length;
        var el = document.getElementById('selectedCount');
        if (el) el.textContent = '已选择 ' + n + ' 项';
    }

    // 存储条动画
    setTimeout(function() {
        var fill = document.querySelector('.storage-fill');
        if (fill) fill.style.width = fill.style.width;
    }, 500);

    console.log('✅ HoloLake 网站云盘系统已加载');
});
