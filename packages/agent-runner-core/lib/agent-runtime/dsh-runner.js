const path = require('path');
const fs = require('fs');
const { REPOSITORY_ROOT } = require('../repo-paths');

const requiredNode = [24, 9, 0];
const requiredVersion = '0.2.2-rc.1';
function versionAtLeast(actual, minimum) {
  const parts = String(actual).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < minimum.length; i += 1) {
    if ((parts[i] || 0) > minimum[i]) return true;
    if ((parts[i] || 0) < minimum[i]) return false;
  }
  return true;
}

function createDshRunner(options = {}) {
  const runAdapter = options.runAdapter || (!options.runtimeRoot
    ? require('./dsh-adapter').createDshAdapter() : null);
  const runtimeRoot = options.runtimeRoot || path.join(REPOSITORY_ROOT, 'runtime', 'deepseek-harness');
  const nodeVersion = options.nodeVersion || (() => {
    try { return `v${JSON.parse(fs.readFileSync(path.join(runtimeRoot, 'node_modules', 'node', 'package.json'), 'utf8')).version}`; }
    catch (_) { return process.version; }
  })();
  const sdkResolve = options.sdkResolve || (() => require.resolve('@deepseek-ai/dsh-sdk-client', { paths: [REPOSITORY_ROOT, runtimeRoot] }));
  const sandboxIsolation = options.sandboxIsolation || runAdapter?.sandboxIsolation || null;
  const credentialIsolation = options.credentialIsolation || runAdapter?.credentialIsolation || null;

  function readiness() {
    const blockers = [];
    let sdkPath = null;
    try { sdkPath = sdkResolve(); } catch (_) { blockers.push('未安装锁定版本的 DSH SDK Client'); }
    let nodeAvailable = false;
    try { nodeAvailable = options.nodeAvailable ? options.nodeAvailable() === true : fs.existsSync(path.join(runtimeRoot, 'node_modules', '.bin', 'node')); } catch (_) {}
    if (!nodeAvailable) blockers.push('未找到 DSH 专用 Node.js 运行时');
    if (!versionAtLeast(nodeVersion, requiredNode)) blockers.push('DSH SDK 运行时要求 Node.js 24.9 或更高版本');
    const command = path.join(runtimeRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
    let runtimeAvailable = false;
    try { runtimeAvailable = options.runtimeAvailable ? options.runtimeAvailable() === true : fs.existsSync(command); } catch (_) {}
    let runtimeVersion = options.runtimeVersion || null;
    if (!runtimeVersion) {
      try { runtimeVersion = JSON.parse(fs.readFileSync(path.join(runtimeRoot, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'), 'utf8')).version; } catch (_) {}
    }
    if (!runtimeAvailable || runtimeVersion !== requiredVersion) blockers.push(`未找到锁定版本 ${requiredVersion} 的 DSH 运行时`);
    let sdkVersion = options.sdkVersion || null;
    if (!sdkVersion && sdkPath) {
      try { sdkVersion = JSON.parse(fs.readFileSync(path.resolve(sdkPath, '..', '..', 'package.json'), 'utf8')).version; } catch (_) {}
    }
    if (sdkPath && sdkVersion !== requiredVersion) blockers.push(`DSH SDK Client 版本需与运行时一致（${requiredVersion}）`);
    let sandboxVerified = false;
    try { sandboxVerified = sandboxIsolation?.verify?.() === true; } catch (_) {}
    if (!sandboxVerified) {
      blockers.push('缺少任务级进程与文件系统隔离，无法限制 Agent 工具访问');
    }
    let credentialVerified = false;
    try { credentialVerified = credentialIsolation?.verify?.() === true; } catch (_) {}
    if (!credentialVerified) {
      blockers.push('缺少 Agent 工具不可读取的任务级模型凭据通道');
    }
    if (!['start', 'get', 'cancel', 'owns'].every(method => typeof runAdapter?.[method] === 'function')) {
      blockers.push('平台 DSH SDK 运行适配器尚未完成，尚未启用运行入口');
    }
    return { ready: blockers.length === 0, blockers, sdkVersion, runtimeVersion, profile: 'sdk' };
  }

  function start(runOptions) {
    const state = readiness();
    if (state.ready) return runAdapter.start(runOptions);
    const error = Object.assign(new Error(state.blockers.join('；')), {
      code: 'DSH_NOT_READY', status: 409, details: state.blockers,
    });
    throw error;
  }

  function get(id) {
    if (!runAdapter?.get) throw Object.assign(new Error('DSH 运行记录不存在'), { status: 404 });
    return runAdapter.get(id);
  }
  function cancel(id) {
    if (!runAdapter?.cancel) throw Object.assign(new Error('DSH 运行记录不存在'), { status: 404 });
    return runAdapter.cancel(id);
  }
  function owns(id) { return runAdapter?.owns?.(id) === true; }

  return { readiness, start, get, cancel, owns };
}

module.exports = { createDshRunner, versionAtLeast, requiredVersion };
