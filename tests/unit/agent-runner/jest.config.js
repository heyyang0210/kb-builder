/** Jest 只负责 Node 单元/集成测试；浏览器 E2E 由 Playwright 独立执行。 */
module.exports = {
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  // Native suites are imported by the Jest bridge but still contain browser callbacks.
  // Instrument production code only; serialized page.evaluate callbacks cannot capture Istanbul helpers.
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
  moduleDirectories: [
    'node_modules',
    '<rootDir>/../../../runtime/agent-runner/node_modules',
  ],
  // Jest 的绝对 moduleDirectories 会把 htmlparser2 的嵌套 entities 错配到旧顶层版本。
  moduleNameMapper: {
    '^entities/decode$': '<rootDir>/../../../runtime/agent-runner/node_modules/htmlparser2/node_modules/entities/dist/commonjs/decode.js',
    '^entities/escape$': '<rootDir>/../../../runtime/agent-runner/node_modules/htmlparser2/node_modules/entities/dist/commonjs/escape.js',
  },
  // Node-native suites and the standalone comments API script use separate runners.
  testMatch: [
    '**/?(*.)+(spec|test).[jt]s?(x)',
    '!**/template-p1.test.js',
    '!**/template-p2.test.js',
    '!**/template-generation.test.js',
    '!**/database-config.test.js',
    '!**/template-workspace.test.js',
    '!**/handbook-incremental-review.test.js',
    '!**/handbook-production-api.test.js',
    '!**/document-comments-api.integration.test.js',
  ],
};
