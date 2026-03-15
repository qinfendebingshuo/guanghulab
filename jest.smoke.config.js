// jest.smoke.config.js
// 冒烟测试 Jest 配置

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/smoke/**/*.test.js'],
  testTimeout: 30000,
};
