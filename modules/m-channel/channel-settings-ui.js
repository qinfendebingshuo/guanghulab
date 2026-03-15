/**
 * channel-settings-ui.js
 * 设置面板UI控制器·环节9
 */
var SettingsUI = (function() {
  // 渲染主题卡片
  function renderThemeCards() {
    var container = document.getElementById('themeCards');
    if (!container) return;
    var current = ChannelSettings.get('theme');
    var themes = ChannelSettings.THEMES;
    var html = '';
    Object.keys(themes).forEach(function(id) {
      var t = themes[id];
      var active = (id === current) ? 'active' : '';
      html += '<div class="theme-card ' + active + '" ' +
        'style="background:' + t.cardBg + '; color:' + t.text + ';" ' +
        'onclick="SettingsUI.selectTheme(\'' + id + '\')">' +
        '<div class="theme-preview" style="background:' + t.bg + ';"></div>' +
        t.name + '</div>';
    });
    container.innerHTML = html;
  }

  // 同步UI状态
  function syncUI() {
    var s = ChannelSettings.get();

    // 下拉框
    var fontSize = document.getElementById('settingFontSize');
    if (fontSize) fontSize.value = s.fontSize;

    var interval = document.getElementById('settingRefreshInterval');
    if (interval) interval.value = s.refreshInterval;

    // 开关
    var toggleMap = {
      settingAnimation: 'animationEnabled',
      settingSidebar: 'sidebarCollapsed',
      settingNotifyModule: 'notifyModuleUpdate',
      settingNotifySystem: 'notifySystem',
      settingNotifySound: 'notifySound',
      settingAnalytics: 'analyticsEnabled',
      settingAutoRefresh: 'autoRefresh'
    };
    Object.keys(toggleMap).forEach(function(elId) {
      var el = document.getElementById(elId);
      if (el) el.checked = !!s[toggleMap[elId]];
    });

    renderThemeCards();
  }

  return {
    // 初始化面板
    init: function() {
      syncUI();
      console.log('⚙️ 设置面板已加载');
    },
    // 选择主题
    selectTheme: function(themeId) {
      ChannelSettings.set('theme', themeId);
      renderThemeCards();
    },
    // 开关变更
    onToggle: function(key, value) {
      ChannelSettings.set(key, value);
      console.log('⚙️ ' + key + ' = ' + value);
    },
    // 下拉变更
    onChange: function(key, value) {
      ChannelSettings.set(key, value);
      console.log('⚙️ ' + key + ' = ' + value);
    },
    // 导出
    exportSettings: function() {
      var json = ChannelSettings.exportJSON();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(json).then(function() {
          alert('✅ 设置已复制到剪贴板！\n\n可以保存为文件或发给其他设备。');
        });
      } else {
        // 降级：显示在弹窗
        prompt('复制下面的内容：', json);
      }
      console.log('⚙️ 设置已导出');
    },
    // 显示导入弹窗
    showImport: function() {
      var modal = document.getElementById('importModal');
      if (modal) modal.classList.add('show');
    },
    // 隐藏导入弹窗
    hideImport: function() {
      var modal = document.getElementById('importModal');
      if (modal) modal.classList.remove('show');
    },
    // 执行导入
    doImport: function() {
      var textarea = document.getElementById('importTextarea');
      if (!textarea || !textarea.value.trim()) {
        alert('请粘贴JSON内容');
        return;
      }
      var ok = ChannelSettings.importJSON(textarea.value.trim());
      if (ok) {
        alert('✅ 设置导入成功！');
        this.hideImport();
        syncUI();
      } else {
        alert('❌ JSON格式错误，请检查内容');
      }
    },
    // 恢复默认
    resetAll: function() {
      if (confirm('确定恢复所有设置为默认值吗？')) {
        ChannelSettings.reset();
        syncUI();
        alert('✅ 已恢复默认设置');
      }
    }
  };
})();
