/** Jest 只负责 Node 单元/集成测试；浏览器 E2E 由 Playwright 独立执行。 */
module.exports = {
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  moduleDirectories: [
    'node_modules',
    '<rootDir>/../../../runtime/agent-runner/node_modules',
  ],
  // These suites intentionally use Node's native test runner and its mock API.
  // The unified Python entry invokes them with `node --test`.
  testMatch: [
    '**/?(*.)+(spec|test).[jt]s?(x)',
    '!**/template-p1.test.js',
    '!**/template-p2.test.js',
    '!**/template-generation.test.js',
  ],
};
