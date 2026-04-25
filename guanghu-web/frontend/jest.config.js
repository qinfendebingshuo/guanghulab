/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  transform: { '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: ['**/__tests__/**/*.(ts|tsx)', '**/*.test.(ts|tsx)'],
};
