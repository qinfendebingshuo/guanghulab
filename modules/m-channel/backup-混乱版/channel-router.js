/**
 * channel-router.js
 * 用户频道路由引擎 - 带过渡动画和状态持久化
 * 集成ChannelState和动画控制
 */

// 依赖全局变量：ChannelState 需要先加载
(function(global) {
  'use strict';

  // 默认配置
  const defaultConfig = {
    containerSelector: '#channel-content',
    routes: {},
    defaultRoute: '/home',
    mode: 'fade', // 'fade' 或 'slide'
    transitionDuration: 300
  };

  class ChannelRouter {
    constructor(config) {
      this.config = Object.assign({}, defaultConfig, config);
      this.container = document.querySelector(this.config.containerSelector);
      if (!this.container) {
        throw new Error(`Container ${this.config.containerSelector} not found`);
      }

      // 确保容器有相对定位
      this.container.style.position = 'relative';
      this.container.classList.add('route-container');

      // 当前活动路由
      this.currentRoute = null;
      this.currentPageElement = null;

      // 防抖定时器
      this.navTimer = null;

      // 绑定方法
      this.navigate = this.navigate.bind(this);
      this.goBack = this.goBack.bind(this);
      this.goForward = this.goForward.bind(this);
      this.setMode = this.setMode.bind(this);
      this.handlePopState = this.handlePopState.bind(this);

      // 初始化模式
      this.container.classList.add(`${this.config.mode}-mode`);

      // 从ChannelState恢复上次的路由
      this.initFromState();

      // 监听浏览器前进后退
      window.addEventListener('popstate', this.handlePopState);

      console.log('[router] 初始化完成，模式：', this.config.mode);
    }

    // 从ChannelState恢复
    initFromState() {
      if (global.ChannelState) {
        const state = global.ChannelState.getState();
        const targetRoute = state.currentRoute || this.config.defaultRoute;
        // 不触发pushState，直接渲染
        this.renderRoute(targetRoute, { replace: true, fromState: true });
        console.log('[router] 从状态恢复路由：', targetRoute);
      } else {
        // 没有状态管理器，走默认
        this.renderRoute(this.config.defaultRoute, { replace: true });
      }
    }

    // 渲染路由（内部方法）
    renderRoute(path, options = {}) {
      const { replace = false, fromState = false } = options;
      const route = this.config.routes[path];
      if (!route) {
        console.warn(`[router] 路由 ${path} 未定义，使用404`);
        // 可以跳转到404页面，这里简单返回
        return;
      }

      // 如果是相同路由且不是强制刷新，不重复渲染
      if (this.currentRoute === path && !options.force) {
        return;
      }

      // 创建新页面元素
      const newPage = document.createElement('div');
      newPage.className = `route-page ${this.config.mode === 'slide' ? 'slide-enter' : ''}`;
      newPage.innerHTML = route.template || route.content || '';

      // 如果有模块加载器，执行模块加载
      if (global.ModuleLoader && route.module) {
        // 这里简化，实际可能需要加载模块
        console.log('[router] 加载模块：', route.module);
      }

      // 旧页面元素
      const oldPage = this.currentPageElement;

      // 设置新页面为激活状态
      newPage.classList.add('active');

      // 如果是滑入模式，根据方向添加额外类
      if (this.config.mode === 'slide') {
        // 通过history判断方向：前进/后退
        const direction = this.getDirection(path);
        if (direction === 'back') {
          this.container.classList.add('backward');
          this.container.classList.remove('forward');
        } else {
          this.container.classList.add('forward');
          this.container.classList.remove('backward');
        }
      }

      // 添加新页面到容器
      this.container.appendChild(newPage);

      // 触发重绘以确保动画
      newPage.offsetHeight;

      // 如果有旧页面，移除它的active类并添加退出动画类
      if (oldPage) {
        oldPage.classList.remove('active');
        if (this.config.mode === 'slide') {
          oldPage.classList.add('slide-exit');
        }
      }

      // 动画结束后清理旧页面
      const onTransitionEnd = (e) => {
        if (e.target === newPage || e.target === oldPage) {
          if (oldPage && oldPage.parentNode) {
            oldPage.parentNode.removeChild(oldPage);
          }
          newPage.removeEventListener('transitionend', onTransitionEnd);
        }
      };
      newPage.addEventListener('transitionend', onTransitionEnd);

      // 更新当前路由
      this.currentRoute = path;
      this.currentPageElement = newPage;

      // 更新导航菜单激活状态
      this.updateActiveNav(path);

      // 保存状态（如果不是从状态恢复来的）
      if (!fromState && global.ChannelState) {
        // 判断是push还是replace
        if (replace) {
          // 替换当前历史记录（不增加新记录）
          // 状态管理需要相应处理：替换当前记录而不是push
          global.ChannelState.setCurrentRoute(path);
          // 同时替换浏览器历史
          if (!options.skipHistory) {
            history.replaceState({ route: path }, '', `#${path}`);
          }
        } else {
          // 正常跳转，push到历史
          global.ChannelState.pushHistory(path);
          if (!options.skipHistory) {
            history.pushState({ route: path }, '', `#${path}`);
          }
        }
      } else if (!global.ChannelState) {
        // 没有状态管理器，只处理浏览器历史
        if (!replace && !options.skipHistory) {
          history.pushState({ route: path }, '', `#${path}`);
        } else if (replace && !options.skipHistory) {
          history.replaceState({ route: path }, '', `#${path}`);
        }
      }

      console.log(`[router] 导航到 ${path}${replace ? ' (replace)' : ''}`);
    }

    // 判断前进后退方向（简单实现：看是否在历史栈中）
    getDirection(path) {
      if (!global.ChannelState) return 'forward';
      const state = global.ChannelState.getState();
      const currentIndex = state.historyIndex;
      const stack = state.historyStack;
      // 如果path在历史栈中且在当前位置之后，是后退？需要更精确
      // 这里简化：根据当前路由和目标的索引比较
      if (this.currentRoute) {
        const currentIdx = stack.indexOf(this.currentRoute);
        const targetIdx = stack.indexOf(path);
        if (targetIdx < currentIdx) return 'back';
      }
      return 'forward';
    }

    // 更新导航菜单激活样式
    updateActiveNav(path) {
      document.querySelectorAll('.channel-nav a').forEach(link => {
        const href = link.getAttribute('href').replace('#', '');
        if (href === path) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    }

    // 公开导航方法
    navigate(path, options = {}) {
      // 防抖处理
      if (this.navTimer) clearTimeout(this.navTimer);
      this.navTimer = setTimeout(() => {
        this.renderRoute(path, options);
        this.navTimer = null;
      }, 10); // 微小延迟确保快速点击不重叠
    }

    // 后退
    goBack() {
      if (global.ChannelState) {
        const prev = global.ChannelState.goBack();
        if (prev) {
          this.renderRoute(prev, { fromState: true, skipHistory: true });
        } else {
          console.log('[router] 已在最前');
        }
      } else {
        history.back();
      }
    }

    // 前进
    goForward() {
      if (global.ChannelState) {
        const next = global.ChannelState.goForward();
        if (next) {
          this.renderRoute(next, { fromState: true, skipHistory: true });
        } else {
          console.log('[router] 已在最后');
        }
      } else {
        history.forward();
      }
    }

    // 处理popstate事件（浏览器前进后退）
    handlePopState(event) {
      const route = event.state?.route || this.config.defaultRoute;
      if (global.ChannelState) {
        // 从状态中恢复索引，但不需要重复push
        this.renderRoute(route, { fromState: true, skipHistory: true });
      } else {
        this.renderRoute(route, { skipHistory: true });
      }
    }

    // 切换动画模式
    setMode(mode) {
      if (mode !== 'fade' && mode !== 'slide') return;
      this.container.classList.remove('fade-mode', 'slide-mode');
      this.container.classList.add(`${mode}-mode`);
      this.config.mode = mode;
      console.log('[router] 切换动画模式为：', mode);
    }
  }

  global.ChannelRouter = ChannelRouter;
})(window);
