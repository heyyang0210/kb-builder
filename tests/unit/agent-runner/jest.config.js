/** Jest 只负责 Node 单元/集成测试；浏览器 E2E 由 Playwright 独立执行。 */
module.exports = {
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
};
