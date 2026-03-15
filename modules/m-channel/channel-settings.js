/**
 * channel-settings.js
 * 频道设置数据管理核心·环节9
 * 统一管理所有用户偏好：主题、布局、通知、显示
 */
const ChannelSettings = (function(){
  const STORAGE_KEY = 'channel-user-settings';

  // 默认设置
  const DEFAULTS = {
    theme: 'dark',          // dark / light / ocean
    accentColor: '#4fc3f7', // 主题强调色
    layout: 'grid',         // grid / list
    fontSize: 'medium',     // small / medium / large
    showWelcome: true,      // 显示欢迎横幅
    notifyModuleUpdate: true, // 模块更新通知
    notifySystem: true,     // 系统通知
    notifySound: false,     // 通知声音
    autoRefresh: true,      // 自动刷新数据
    refreshInterval: 30,    // 刷新间隔（秒）
    sidebarCollapsed: false,// 侧边栏收起
    animationEnabled: true, // 过渡动画
    analyticsEnabled: true  // 数据采集
  };

  // 主题预设
  const THEMES = {
    dark: {
      name: '深色模式',
      bg: '#0d1117',
      cardBg: '#1a1a2e',
      text: '#e0e0e0',
      accent: '#4fc3f7',
      border: '#2a2a4a'
    },
    light: {
      name: '浅色模式',
      bg: '#f5f5f5',
      cardBg: '#ffffff',
      text: '#333333',
      accent: '#4fc3f7',
      border: '#dddddd'
    },
    ocean: {
      name: '海洋模式',
      bg: '#1a2f3f',
      cardBg: '#1e3a4a',
      text: '#e0f0fa',
      accent: '#7bc8e0',
      border: '#2d5a6e'
    }
  };

  // 加载设置
  function load() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        var parsed = JSON.parse(stored);
        // 合并默认值，保证新字段存在
        var merged = {};
        Object.keys(DEFAULTS).forEach(function(k) {
          merged[k] = parsed.hasOwnProperty(k) ? parsed[k] : DEFAULTS[k];
        });
        return merged;
      }
    } catch(e) {
      console.warn('读取设置失败，使用默认值', e);
    }
    return JSON.parse(JSON.stringify(DEFAULTS));
  }

  function save(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  // ── 应用主题到页面 ──
  function applyTheme(themeName) {
    var theme = THEMES[themeName] || THEMES.dark;
    var root = document.documentElement;
    root.style.setProperty('--bg-color', theme.bg);
    root.style.setProperty('--card-bg', theme.cardBg);
    root.style.setProperty('--text-color', theme.text);
    root.style.setProperty('--accent-color', theme.accent);
    root.style.setProperty('--border-color', theme.border);
    document.body.style.background = theme.bg;
    document.body.style.color = theme.text;
    console.log('⚙️ 主题已切换：' + theme.name);
  }

  // ── 应用字体大小 ──
  function applyFontSize(size) {
    var map = { small: '13px', medium: '15px', large: '17px' };
    var fontSize = map[size] || '15px';
    document.documentElement.style.setProperty('--base-font-size', fontSize);
    document.body.style.fontSize = fontSize;
    console.log('⚙️ 字体大小已应用：' + size + ' (' + fontSize + ')');
  }

  // ── 公开方法 ──
  return {
    DEFAULTS: DEFAULTS,
    THEMES: THEMES,
    get: function(key) {
      var s = load();
      return key ? s[key] : s;
    },
    set: function(key, value) {
      var s = load();
      s[key] = value;
      save(s);
      // 即时应用
      if (key === 'theme') applyTheme(value);
      if (key === 'fontSize') applyFontSize(value);
      if (key === 'animationEnabled') {
        document.body.classList.toggle('no-animation', !value);
      }
    },
    setMultiple: function(obj) {
      var s = load();
      Object.keys(obj).forEach(function(k) { s[k] = obj[k]; });
      save(s);
      if (obj.theme) applyTheme(obj.theme);
      if (obj.fontSize) applyFontSize(obj.fontSize);
    },
    reset: function() {
      save(JSON.parse(JSON.stringify(DEFAULTS)));
      applyTheme(DEFAULTS.theme);
      applyFontSize(DEFAULTS.fontSize);
      console.log('⚙️ 所有设置已恢复默认');
    },
    // 导出为JSON字符串
    exportJSON: function() {
      var s = load();
      return JSON.stringify(s, null, 2);
    },
    // 从JSON字符串导入
    importJSON: function(jsonStr) {
      try {
        var imported = JSON.parse(jsonStr);
        var merged = {};
        Object.keys(DEFAULTS).forEach(function(k) {
          merged[k] = imported.hasOwnProperty(k) ? imported[k] : DEFAULTS[k];
        });
        save(merged);
        applyTheme(merged.theme);
        applyFontSize(merged.fontSize);
        console.log('✅ 设置导入成功');
        return true;
      } catch(e) {
        console.error('❌ 导入失败: JSON格式错误');
        return false;
      }
    },
    // 初始化（页面加载时调用）
    init: function() {
      var s = load();
      applyTheme(s.theme);
      applyFontSize(s.fontSize);
      if (!s.animationEnabled) {
        document.body.classList.add('no-animation');
      }
      console.log('⚙️ 频道设置已初始化');
    },
    getThemeList: function() {
      return Object.keys(THEMES).map(function(k) {
        return { id: k, name: THEMES[k].name };
      });
    }
  };
})();

// 页面加载时自动初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    ChannelSettings.init();
  });
} else {
  ChannelSettings.init();
}
