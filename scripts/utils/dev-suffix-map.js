// scripts/utils/dev-suffix-map.js
// 开发者广播编号后缀 → DEV-ID 映射表
//
// 广播编号格式: BC-{模块}-{序号}-{后缀}
// 后缀是开发者名字拼音首字母缩写

'use strict';

// 后缀→开发者编号映射
var SUFFIX_MAP = {
  'YY': 'DEV-001',    // 页页
  'FM': 'DEV-002',    // 肥猫
  'YF': 'DEV-003',    // 燕樊
  'ZZ': 'DEV-004',    // 之之
  'XCM': 'DEV-005',   // 小草莓
  'HE': 'DEV-009',    // 花尔
  'JZ': 'DEV-010',    // 桔子
  'CCNN': 'DEV-011',  // 匆匆那年
  'AW': 'DEV-012',    // Awen
  'XX': 'DEV-013',    // 小兴
  'SY': 'DEV-014',    // 时雨
};

/**
 * 从广播编号中提取开发者编号
 * @param {string} broadcastId - 广播编号（如 BC-M22-009-AW）
 * @returns {string} 开发者编号（如 DEV-012），未找到返回空字符串
 */
function getDevIdFromBroadcast(broadcastId) {
  var suffixMatch = (broadcastId || '').match(/BC-[A-Z0-9]+-\d+-([A-Z]+)/i);
  var suffix = suffixMatch ? suffixMatch[1].toUpperCase() : '';
  return SUFFIX_MAP[suffix] || '';
}

module.exports = {
  SUFFIX_MAP: SUFFIX_MAP,
  getDevIdFromBroadcast: getDevIdFromBroadcast,
};
