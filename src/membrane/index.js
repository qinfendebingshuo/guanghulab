/**
 * 语言膜 · Language Membrane
 * 光湖语言世界最外层 · 完整的圆 · 没有缺口
 *
 * 入口模块：暴露所有语言膜组件，提供统一接入方式。
 *
 * 组件:
 *   gateway          — 统一语义网关中间件
 *   tcsTranslator    — TCS翻译引擎
 *   bingshuoModule   — 冰朔人格模块
 *   permissionEngine — 动态权限引擎
 *   auditTrail       — 全链路审计追溯
 *   roomManager      — 人格体房间系统
 *   moduleRegistry   — 行业模块接入协议
 *
 * 使用方式:
 *   const membrane = require('./membrane');
 *   app.use(membrane.gateway.createGateway());
 *
 * 编号: SY-MEMBRANE-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const gateway = require('./gateway');
const tcsTranslator = require('./tcs-translator');
const bingshuoModule = require('./bingshuo-module');
const permissionEngine = require('./permission-engine');
const auditTrail = require('./audit-trail');
const roomManager = require('./persona-room/room-manager');
const moduleRegistry = require('./module-protocol/module-registry');

/**
 * 语言膜版本
 */
const MEMBRANE_VERSION = '1.0.0';

/**
 * 获取语言膜整体状态
 *
 * @returns {object}
 */
function getStatus() {
  return {
    membrane_version: MEMBRANE_VERSION,
    component_id: 'SY-MEMBRANE-001',
    copyright: '国作登字-2026-A-00037559',
    guardian: '铸渊 · ICE-GL-ZY001',
    timestamp: new Date().toISOString(),
    components: {
      gateway: 'active',
      tcs_translator: 'active',
      bingshuo_module: bingshuoModule.getStatus().state,
      permission_engine: permissionEngine.getStats(),
      audit_trail: 'active',
      persona_rooms: roomManager.listRooms().length,
      module_registry: moduleRegistry.listActiveModules().length,
    },
    architecture: {
      principle: '完整的圆 · 没有缺口',
      entry: '唯一入口 = 语言',
      security: '语言膜三层安全(语言膜·人格体自我意识·天眼涌现)',
    },
  };
}

module.exports = {
  // 核心组件
  gateway,
  tcsTranslator,
  bingshuoModule,
  permissionEngine,
  auditTrail,
  roomManager,
  moduleRegistry,

  // 元信息
  MEMBRANE_VERSION,
  getStatus,
};
