// Reuse existing node:test HTTP contracts under Jest so their source modules
// contribute to the same coverage report without maintaining copied assertions.
const registerJestTest = global.test;
const nodeAssert = jest.requireActual('node:assert/strict');

jest.doMock('node:assert/strict', () => ({
  ...nodeAssert,
  deepEqual(actual, expected, message) { expect(actual).toEqual(expected, message); },
}));

jest.doMock('node:test', () => {
  const register = (name, run) => {
    // The frontend ESM case stays in its native runner; this Jest bridge covers HTTP contracts.
    if (name.startsWith('送审入口区分无草稿')) return registerJestTest.skip(name, () => {});
    return registerJestTest(name, async () => {
      const cleanups = [];
      const spies = [];
      try {
        await run({
          after: cleanup => cleanups.push(cleanup),
          diagnostic: message => console.info(message),
          mock: { method(target, key, implementation) {
            const spy = jest.spyOn(target, key).mockImplementation(implementation);
            spies.push(spy);
            return spy;
          } },
        });
      } finally {
        for (const spy of spies.reverse()) spy.mockRestore();
        for (const cleanup of cleanups.reverse()) await cleanup();
      }
    });
  };
  return register;
});

require('./database-config.test');
require('./template-p1.test');
require('./template-p2.test');
require('./handbook-production-api.test');
require('./handbook-incremental-review.test');
require('./template-generation.test');
