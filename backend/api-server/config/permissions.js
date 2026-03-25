/**
 * 权限等级定义 · 开发者权限沙箱系统
 *
 * 4 级权限模型：观察者 → 学习者 → 执行者 → 管理者
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

// 权限等级定义
var PERMISSION_LEVELS = {
  0: {
    name: '观察者',
    label: '👀 观察者',
    permissions: [
      'dev:read_self',
      'ticket:read',
      'syslog:read',
      'agent:read',
      'repo:read'
    ],
    description: '只读权限，熟悉系统'
  },
  1: {
    name: '学习者',
    label: '📖 学习者',
    permissions: [
      'dev:read_self',
      'ticket:read', 'ticket:create',
      'syslog:read', 'syslog:submit',
      'agent:read',
      'repo:read',
      'deploy:preview'
    ],
    description: '预览站可写，正式站只读'
  },
  2: {
    name: '执行者',
    label: '⚡ 执行者',
    permissions: [
      'dev:read_self', 'dev:update_self',
      'ticket:read', 'ticket:create', 'ticket:update',
      'syslog:read', 'syslog:submit',
      'agent:read',
      'repo:read',
      'deploy:preview', 'deploy:production',
      'maintenance:log',
      'approval:decide'
    ],
    description: '可操作自己的模块，含正式站部署和授权决策'
  },
  3: {
    name: '管理者',
    label: '👑 管理者',
    permissions: [
      'dev:read_self', 'dev:read_all', 'dev:update_self', 'dev:update_all',
      'ticket:read', 'ticket:create', 'ticket:update', 'ticket:delete',
      'syslog:read', 'syslog:submit',
      'agent:read', 'agent:update',
      'repo:read',
      'deploy:preview', 'deploy:production',
      'broadcast:create',
      'maintenance:log',
      'permission:manage',
      'approval:decide', 'approval:create',
      'system:internal'
    ],
    description: '系统管理员，全部权限'
  }
};

// 开发者默认权限配置
var DEV_PERMISSIONS = {
  'TCS-0002': { level: 3, environment: 'production' },
  'DEV-001':  { level: 0, environment: 'preview' },
  'DEV-002':  { level: 0, environment: 'preview' },
  'DEV-003':  { level: 0, environment: 'preview' },
  'DEV-004':  { level: 0, environment: 'preview' },
  'DEV-005':  { level: 0, environment: 'preview' },
  'DEV-009':  { level: 0, environment: 'preview' },
  'DEV-010':  { level: 0, environment: 'preview' },
  'DEV-011':  { level: 0, environment: 'preview' },
  'DEV-012':  { level: 0, environment: 'preview' }
};

// 开发者 → 模块映射
var DEV_MODULES = {
  'DEV-001': ['backend/', 'src/'],
  'DEV-002': ['frontend/', 'persona-selector/', 'chat-bubble/'],
  'DEV-003': ['settings/', 'cloud-drive/'],
  'DEV-004': ['dingtalk-bot/'],
  'DEV-005': ['status-board/'],
  'DEV-009': ['user-center/'],
  'DEV-010': ['ticket-system/', 'data-stats/', 'dynamic-comic/'],
  'DEV-011': ['writing-workspace/'],
  'DEV-012': ['notification-center/'],
  'TCS-0002': ['*']
};

module.exports = {
  PERMISSION_LEVELS: PERMISSION_LEVELS,
  DEV_PERMISSIONS: DEV_PERMISSIONS,
  DEV_MODULES: DEV_MODULES
};
