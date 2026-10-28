const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center');
function load(name, exports) {
  const source = fs.readFileSync(path.join(base, 'common', name), 'utf8').replace(/export function /g, 'function ');
  return new Function(`${source}\nreturn { ${exports.join(',')} };`)();
}
const viewport = load('viewport-runtime.js', ['initViewportRuntime']);
const scroll = load('scroll-runtime.js', ['getScrollOwner', 'inspectScrollRegion', 'inspectScrollContract', 'initScrollRuntime']);
function environment() {
  const listeners = new Map();
  const element = () => {
    const values = new Map();
    return { dataset: {}, children: [], clientHeight: 0, scrollHeight: 0, scrollTop: 0,
      style: { setProperty: (key, value) => values.set(key, value), removeProperty: key => values.delete(key), getPropertyValue: key => values.get(key) || '' },
      getBoundingClientRect: () => ({ height: 0 }), getClientRects: () => [{}], closest: () => null,
      matches(selector) { return selector.includes('data-scroll-owner') && Boolean(this.dataset.scrollOwner); },
      append(child) { this.children.push(child); child.parentElement = this; },
      remove() { this.parentElement.children = this.parentElement.children.filter(child => child !== this); },
      querySelectorAll: () => [] };
  };
  const root = element(), body = element(), shell = element(), main = element();
  main.dataset.scrollOwner = 'main'; main.style.overflowY = 'auto'; main.clientHeight = 900; main.scrollHeight = 2000;
  body.append(shell); shell.append(main);
  main.cloneNode = () => { const item = element(); item.dataset.scrollOwner = 'main'; item.ownerDocument = doc; return item; };
  const doc = { documentElement: root, body, scrollingElement: root,
    createElement: element, getElementById: id => id === 'app-shell' ? shell : main,
    querySelector: () => main,
    querySelectorAll(selector) {
      if (selector === '[data-scroll-owner="main"]') return shell.children.filter(item => item.dataset.scrollOwner);
      if (selector === 'body > div') return body.children;
      if (selector === '#app-shell *') return [...shell.children, ...main.children];
      return [];
    }, addEventListener: jest.fn(), removeEventListener: jest.fn() };
  const win = { document: doc, innerHeight: 900, matchMedia: () => ({ matches: true }),
    console: { warn: jest.fn() },
    getComputedStyle: item => ({ overflowY: item.style.overflowY || 'visible', getPropertyValue: key => item.style.getPropertyValue(key) }),
    requestAnimationFrame: jest.fn(() => 1), cancelAnimationFrame: jest.fn(),
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
    dispatchEvent: event => listeners.get(event.type)?.(event), Event: class { constructor(type) { this.type = type; } },
    MutationObserver: class { observe() {} disconnect() {} } };
  doc.defaultView = win; main.ownerDocument = doc; root.ownerDocument = doc;
  const create = doc.createElement;
  doc.createElement = () => { const item = create(); item.ownerDocument = doc; return item; };
  shell.getBoundingClientRect = () => ({ height: 900 });
  return { dom: { window: { close() {} } }, window: win, document: doc, main };
}
test('旧环境无 visualViewport 时测量回退，1px 阈值与事件清理', () => {
  const env = environment();
  const runtime = viewport.initViewportRuntime(env);
  expect(env.document.documentElement.style.getPropertyValue('--kc-viewport-height')).toBe('900px');
  env.window.innerHeight = 899.5;
  runtime.update();
  expect(env.document.documentElement.style.getPropertyValue('--kc-viewport-height')).toBe('900px');
  runtime.destroy();
  expect(env.document.documentElement.style.getPropertyValue('--kc-viewport-height')).toBe('');
  expect(env.document.querySelectorAll('body > div')).toHaveLength(1);
  env.dom.window.close();
});
test('原生 dvh 正常时不覆盖令牌，异常时使用 visualViewport；缩放不收缩应用壳', () => {
  const env = environment();
  env.window.CSS = { supports: () => true };
  env.window.visualViewport = { height: 800, scale: 1, addEventListener: jest.fn(), removeEventListener: jest.fn() };
  const bounds = jest.fn().mockReturnValue({ height: 800 });
  const create = env.document.createElement;
  env.document.createElement = () => { const item = create(); item.getBoundingClientRect = bounds; return item; };
  const runtime = viewport.initViewportRuntime(env);
  expect(env.document.documentElement.dataset.viewportSource).toBe('native');
  bounds.mockReturnValue({ height: 900 });
  runtime.update();
  expect(env.document.documentElement.style.getPropertyValue('--kc-viewport-height')).toBe('800px');
  env.window.visualViewport.scale = 2;
  runtime.update();
  expect(env.document.documentElement.style.getPropertyValue('--kc-viewport-height')).toBe('');
  runtime.destroy();
  expect(env.window.visualViewport.removeEventListener).toHaveBeenCalled();
  env.dom.window.close();
});
test('resize 合并为一帧', () => {
  const env = environment();
  const request = jest.spyOn(env.window, 'requestAnimationFrame');
  const runtime = viewport.initViewportRuntime(env);
  env.window.dispatchEvent(new env.window.Event('resize'));
  env.window.dispatchEvent(new env.window.Event('resize'));
  expect(request).toHaveBeenCalledTimes(1);
  runtime.destroy(); env.dom.window.close();
});
test('visualViewport resize 进入同一节流通道', () => {
  const env = environment();
  const viewportListeners = new Map();
  env.window.visualViewport = {
    height: 800,
    scale: 1,
    addEventListener: (name, listener) => viewportListeners.set(name, listener),
    removeEventListener: (name) => viewportListeners.delete(name),
  };
  const request = jest.spyOn(env.window, 'requestAnimationFrame');
  const runtime = viewport.initViewportRuntime(env);
  expect(viewportListeners.has('resize')).toBe(true);
  viewportListeners.get('resize')();
  expect(request).toHaveBeenCalledTimes(1);
  runtime.destroy();
  expect(viewportListeners.has('resize')).toBe(false);
  env.dom.window.close();
});
test('壳异常解除锁定，恢复后重新选择主区；诊断不含业务文本', () => {
  const env = environment();
  env.main.textContent = '私有正文不允许输出';
  const runtime = scroll.initScrollRuntime(env);
  expect(scroll.getScrollOwner(env.document)).toBe(env.main);
  const report = scroll.inspectScrollContract(env.document);
  expect(report.issues).toEqual([]);
  expect(report.owner.scrollable).toBe(true);
  expect(JSON.stringify(report)).not.toContain('私有正文');
  env.document.getElementById('app-shell').getBoundingClientRect = () => ({ height: 2000 });
  runtime.refresh();
  expect(env.document.documentElement.dataset.scrollMode).toBe('document');
  env.document.getElementById('app-shell').getBoundingClientRect = () => ({ height: 900 });
  runtime.refresh();
  expect(scroll.getScrollOwner(env.document)).toBe(env.main);
  runtime.destroy(); env.dom.window.close();
});
test('重复主区和未声明滚动区触发诊断', () => {
  const env = environment();
  const duplicate = env.main.cloneNode(); duplicate.getClientRects = () => [{}];
  env.main.parentElement.append(duplicate);
  const region = env.document.createElement('div'); region.style.overflowY = 'auto';
  region.getClientRects = () => [{}];
  region.clientHeight = 20; region.scrollHeight = 100;
  env.main.append(region);
  const report = scroll.inspectScrollContract(env.document);
  expect(report.issues).toContain('主滚动所有者重复');
  expect(report.issues).toContain('存在未声明的纵向滚动区域');
  env.dom.window.close();
});
test('声明区域被裁剪时失败，空区域不误报', () => {
  const env = environment();
  const region = env.document.createElement('div');
  region.dataset.scrollRegion = 'panel';
  region.style.overflowY = 'hidden'; region.clientHeight = 30; region.scrollHeight = 100;
  const query = env.document.querySelectorAll;
  env.document.querySelectorAll = selector => selector === '[data-scroll-region]' ? [region] : query(selector);
  expect(scroll.inspectScrollContract(env.document).issues).toContain('声明的局部滚动区域不可滚动');
  region.scrollHeight = 30;
  expect(scroll.inspectScrollContract(env.document).issues).toEqual([]);
});
test('主区自身高度无效或滚动被锁定时解除 body 锁定', () => {
  const env = environment();
  const runtime = scroll.initScrollRuntime(env);
  env.main.clientHeight = 2000;
  runtime.refresh();
  expect(env.document.documentElement.dataset.scrollMode).toBe('document');
  env.main.clientHeight = 900; env.main.style.overflowY = 'hidden';
  runtime.refresh();
  expect(env.document.documentElement.dataset.scrollMode).toBe('document');
  runtime.destroy();
});
test('手动更新不丢失待处理帧，销毁能取消帧', () => {
  const env = environment();
  const runtime = viewport.initViewportRuntime(env);
  env.window.dispatchEvent(new env.window.Event('resize'));
  runtime.update(); runtime.destroy();
  expect(env.window.cancelAnimationFrame).toHaveBeenCalledWith(1);
});
test('模块不绕过公共令牌定义 dvh 或应用壳尺寸', () => {
  function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]); }
  for (const file of walk(path.join(base, 'modules')).filter(file => file.endsWith('.css'))) {
    const css = fs.readFileSync(file, 'utf8');
    expect(css).not.toMatch(/\d+dvh/);
    expect(css).not.toMatch(/\.app-shell\s*\{/);
  }
});


test('实时刷新只检查声明区，显式诊断仍能发现未声明滚动区', () => {
  const env = environment();
  const region = env.document.createElement('div');
  region.style.overflowY = 'auto'; region.clientHeight = 20; region.scrollHeight = 100;
  env.main.append(region);
  const query = env.document.querySelectorAll;
  const queried = [];
  env.document.querySelectorAll = selector => { queried.push(selector); return query(selector); };
  const runtime = scroll.initScrollRuntime(env);
  runtime.refresh();
  expect(queried).not.toContain('#app-shell *');
  expect(scroll.inspectScrollContract(env.document).issues).toContain('存在未声明的纵向滚动区域');
  expect(queried).toContain('#app-shell *');
  runtime.destroy();
});
