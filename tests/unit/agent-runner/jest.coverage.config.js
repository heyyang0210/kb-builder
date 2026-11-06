const path = require('path');
const base = require('./jest.config');

module.exports = {
  ...base,
  rootDir: path.resolve(__dirname, '../../..'),
  roots: [
    '<rootDir>/tests/unit/agent-runner',
    '<rootDir>/packages/agent-runner-core',
    '<rootDir>/apps/knowledge-center-api',
    '<rootDir>/apps/knowledge-center-web',
  ],
  moduleDirectories: ['node_modules', '<rootDir>/runtime/agent-runner/node_modules'],
  moduleNameMapper: {
    '^marked$': '<rootDir>/runtime/agent-runner/node_modules/marked/lib/marked.umd.js',
    '^entities/decode$': '<rootDir>/runtime/agent-runner/node_modules/htmlparser2/node_modules/entities/dist/commonjs/decode.js',
    '^entities/escape$': '<rootDir>/runtime/agent-runner/node_modules/htmlparser2/node_modules/entities/dist/commonjs/escape.js',
  },
  collectCoverageFrom: [
    'packages/agent-runner-core/lib/**/*.js',
    'packages/agent-runner-core/routes/**/*.js',
    'packages/agent-runner-core/middleware/**/*.js',
    'apps/knowledge-center-api/server.js',
    'apps/knowledge-center-web/frontend-server.js',
  ],
};
