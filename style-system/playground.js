// playground.js

const sidebar = document.getElementById('pg-sidebar');

// 组件列表（10类）
const components = [
  { id: 'button', name: '按钮 Button', desc: '基础交互按钮，支持多种样式变体' },
  { id: 'input', name: '输入框 Input', desc: '文本输入框，支持多种状态' },
  { id: 'card', name: '卡片 Card', desc: '内容容器，带阴影和边框' },
  { id: 'tag', name: '标签 Tag', desc: '用于标记、分类' },
  { id: 'alert', name: '提示框 Alert', desc: '反馈信息，成功/警告/错误' },
  { id: 'modal', name: '模态框 Modal', desc: '弹窗，需要时显示' },
  { id: 'progress', name: '进度条 Progress', desc: '展示操作进度' },
  { id: 'switch', name: '开关 Switch', desc: '切换状态' },
  { id: 'avatar', name: '头像组 Avatar', desc: '用户头像，支持组合' },
  { id: 'breadcrumb', name: '面包屑 Breadcrumb', desc: '显示当前页面位置' }
];

// 生成侧边栏导航
function renderSidebar() {
  const ul = document.createElement('ul');
  components.forEach(comp => {
    const li = document.createElement('li');
    li.textContent = comp.name;
    li.dataset.target = comp.id;
    li.addEventListener('click', () => {
      document.getElementById(`comp-${comp.id}`).scrollIntoView({ behavior: 'smooth' });
      // 手机端点击后关闭侧边栏
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('active');
      }
    });
    ul.appendChild(li);
  });
  sidebar.innerHTML = '';
  sidebar.appendChild(ul);
}

// 生成所有组件演示区块（包含真实示例）
function renderContent() {
  const content = document.getElementById('pg-content');
  components.forEach(comp => {
    const section = document.createElement('section');
    section.id = `comp-${comp.id}`;
    section.className = 'comp-section';

    const h2 = document.createElement('h2');
    h2.textContent = comp.name;
    section.appendChild(h2);

    const desc = document.createElement('p');
    desc.className = 'comp-desc';
    desc.textContent = comp.desc;
    section.appendChild(desc);

    const preview = document.createElement('div');
    preview.className = 'comp-preview';
    preview.id = `preview-${comp.id}`;

    // 根据组件类型填充示例
    if (comp.id === 'button') {
      preview.innerHTML = `
        <button class="btn btn-primary">主要按钮</button>
        <button class="btn btn-secondary">次要按钮</button>
        <button class="btn btn-outline">线框按钮</button>
        <button class="btn btn-disabled" disabled>禁用按钮</button>
      `;
    } else if (comp.id === 'input') {
      preview.innerHTML = `
        <input type="text" class="input" placeholder="普通输入框">
        <input type="text" class="input" placeholder="禁用输入框" disabled>
        <input type="text" class="input error" placeholder="错误状态">
      `;
    } else if (comp.id === 'card') {
      preview.innerHTML = `
        <div class="card" style="width: 200px; padding: 1rem;">
          <h3>卡片标题</h3>
          <p>卡片内容，可放置任意元素。</p>
          <button class="btn btn-primary">操作</button>
        </div>
      `;
    } else if (comp.id === 'tag') {
      preview.innerHTML = `
        <span class="tag">默认标签</span>
        <span class="tag tag-primary">主要标签</span>
        <span class="tag tag-success">成功标签</span>
        <span class="tag tag-warning">警告标签</span>
        <span class="tag tag-danger">危险标签</span>
      `;
    } else if (comp.id === 'alert') {
      preview.innerHTML = `
        <div class="alert alert-info">这是一条信息提示</div>
        <div class="alert alert-success">操作成功！</div>
        <div class="alert alert-warning">请注意！</div>
        <div class="alert alert-error">出错了！</div>
      `;
    } else if (comp.id === 'modal') {
      preview.innerHTML = `
        <div class="modal" style="position: static; display: block; opacity: 1; transform: none; box-shadow: none; background: var(--modal-bg, #fff);">
          <div class="modal-header">模态框标题</div>
          <div class="modal-body">这是模态框的内容</div>
          <div class="modal-footer">
            <button class="btn btn-secondary">取消</button>
            <button class="btn btn-primary">确认</button>
          </div>
        </div>
        <p style="margin-top: 0.5rem; color: #999;">（静态展示，实际是浮层）</p>
      `;
    } else if (comp.id === 'progress') {
      preview.innerHTML = `
        <div class="progress">
          <div class="progress-bar" style="width: 45%;">45%</div>
        </div>
        <div class="progress">
          <div class="progress-bar" style="width: 80%;">80%</div>
        </div>
        <div class="progress">
          <div class="progress-bar" style="width: 100%;">100%</div>
        </div>
      `;
    } else if (comp.id === 'switch') {
      preview.innerHTML = `
        <label class="switch">
          <input type="checkbox" checked> <span class="slider"></span>
        </label>
        <label class="switch">
          <input type="checkbox"> <span class="slider"></span>
        </label>
        <label class="switch">
          <input type="checkbox" disabled> <span class="slider"></span>
        </label>
      `;
    } else if (comp.id === 'avatar') {
      preview.innerHTML = `
        <div class="avatar-group">
          <div class="avatar">A</div>
          <div class="avatar">B</div>
          <div class="avatar">C</div>
          <div class="avatar">+3</div>
        </div>
        <div class="avatar" style="margin-top: 0.5rem;">单人</div>
      `;
    } else if (comp.id === 'breadcrumb') {
      preview.innerHTML = `
        <nav class="breadcrumb">
          <a href="#">首页</a> /
          <a href="#">分类</a> /
          <span>当前页面</span>
        </nav>
      `;
    }

    section.appendChild(preview);

    const codeDiv = document.createElement('div');
    codeDiv.className = 'comp-code';
    codeDiv.id = `code-${comp.id}`;
    const pre = document.createElement('pre');

    if (comp.id === 'button') {
      pre.textContent = `<button class="btn btn-primary">主要按钮</button>\n<button class="btn btn-secondary">次要按钮</button>\n<button class="btn btn-outline">线框按钮</button>`;
    } else if (comp.id === 'input') {
      pre.textContent = `<input type="text" class="input" placeholder="普通输入框">\n<input type="text" class="input error" placeholder="错误状态">`;
    } else if (comp.id === 'card') {
      pre.textContent = `<div class="card">\n  <h3>卡片标题</h3>\n  <p>内容</p>\n  <button class="btn btn-primary">操作</button>\n</div>`;
    } else if (comp.id === 'tag') {
      pre.textContent = `<span class="tag">默认</span>\n<span class="tag tag-primary">主要</span>`;
    } else if (comp.id === 'alert') {
      pre.textContent = `<div class="alert alert-info">信息</div>\n<div class="alert alert-success">成功</div>`;
    } else if (comp.id === 'modal') {
      pre.textContent = `<div class="modal">\n  <div class="modal-header">标题</div>\n  <div class="modal-body">内容</div>\n  <div class="modal-footer">\n    <button class="btn">取消</button>\n    <button class="btn btn-primary">确认</button>\n  </div>\n</div>`;
    } else if (comp.id === 'progress') {
      pre.textContent = `<div class="progress">\n  <div class="progress-bar" style="width: 50%;">50%</div>\n</div>`;
    } else if (comp.id === 'switch') {
      pre.textContent = `<label class="switch">\n  <input type="checkbox">\n  <span class="slider"></span>\n</label>`;
    } else if (comp.id === 'avatar') {
      pre.textContent = `<div class="avatar-group">\n  <div class="avatar">A</div>\n  <div class="avatar">B</div>\n</div>`;
    } else if (comp.id === 'breadcrumb') {
      pre.textContent = `<nav class="breadcrumb">\n  <a href="#">首页</a> /\n  <a href="#">分类</a> /\n  <span>当前</span>\n</nav>`;
    }

    codeDiv.appendChild(pre);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = '复制';
    copyBtn.onclick = () => copyCode(comp.id);
    codeDiv.appendChild(copyBtn);

    section.appendChild(codeDiv);

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-code-btn';
    toggleBtn.textContent = '查看代码 ▼';
    toggleBtn.onclick = () => toggleCode(comp.id);
    section.appendChild(toggleBtn);

    content.appendChild(section);
  });
}

// 切换代码显示/隐藏
window.toggleCode = function(compId) {
  const codeDiv = document.getElementById(`code-${compId}`);
  const toggleBtn = document.querySelector(`#comp-${compId} .toggle-code-btn`);
  if (codeDiv.style.display === 'none' || !codeDiv.style.display) {
    codeDiv.style.display = 'block';
    toggleBtn.textContent = '隐藏代码 ▲';
  } else {
    codeDiv.style.display = 'none';
    toggleBtn.textContent = '查看代码 ▼';
  }
};

// 复制代码
window.copyCode = function(compId) {
  const codeDiv = document.getElementById(`code-${compId}`);
  const code = codeDiv.querySelector('pre').innerText;
  navigator.clipboard.writeText(code).then(() => {
    alert('代码已复制！');
  });
};

// 滚动高亮
function setupIntersectionObserver() {
  const sections = document.querySelectorAll('.comp-section');
  const navItems = document.querySelectorAll('#pg-sidebar li');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id.replace('comp-', '');
        navItems.forEach(item => {
          item.classList.remove('active');
          if (item.dataset.target === id) {
            item.classList.add('active');
          }
        });
      }
    });
  }, { threshold: 0.3 });

  sections.forEach(section => observer.observe(section));
}

// 汉堡菜单交互
const menuToggle = document.getElementById('menuToggle');
if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
  });
}

// 窗口大小改变时，如果大于768px，强制移除active类
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    sidebar.classList.remove('active');
  }
});

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  renderContent();
  setupIntersectionObserver();
});
