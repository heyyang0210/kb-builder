export function getScrollOwner(doc = document) {
  return doc.documentElement.dataset.scrollMode === 'main'
    ? doc.querySelector('[data-scroll-owner="main"]') : doc.scrollingElement;
}

export function inspectScrollRegion(element) {
  if (!element) return null;
  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  const overflow = element.scrollHeight > element.clientHeight + 1;
  return {
    element: (element.tagName || 'element').toLowerCase(),
    semantic: element.dataset.scrollRegion || element.dataset.scrollOwner || 'document',
    clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, scrollTop: element.scrollTop,
    overflowY: style.overflowY, overflow,
    scrollable: element.clientHeight > 0 && overflow && /auto|scroll|overlay/.test(style.overflowY),
  };
}

export function inspectScrollContract(doc = document, { scanUndeclared = true } = {}) {
  const owner = getScrollOwner(doc);
  const active = element => element.getClientRects().length && !element.closest('[hidden]');
  const declared = [...doc.querySelectorAll('[data-scroll-owner="main"]')].filter(active);
  const undeclared = scanUndeclared ? [...doc.querySelectorAll('#app-shell *')].filter(element => {
    if (!active(element) || element === owner || element.matches('[data-scroll-owner], [data-scroll-region], textarea, select')) return false;
    return inspectScrollRegion(element).scrollable;
  }) : [];
  const issues = [];
  if (doc.documentElement.dataset.scrollMode === 'main' && !owner) issues.push('缺少主滚动所有者');
  if (declared.length > 1) issues.push('主滚动所有者重复');
  if (undeclared.length) issues.push('存在未声明的纵向滚动区域');
  const invalid = [...doc.querySelectorAll('[data-scroll-region]')].filter(element => {
    if (!active(element)) return false;
    const info = inspectScrollRegion(element);
    return info.overflow && !info.scrollable && info.overflowY !== 'visible';
  });
  if (invalid.length) issues.push('声明的局部滚动区域不可滚动');
  if (doc.documentElement.dataset.scrollMode === 'main' && owner) {
    const info = inspectScrollRegion(owner);
    if (info.clientHeight <= 0 || (info.overflow && !info.scrollable)) issues.push('主内容滚动区域无效');
  }
  return { mode: doc.documentElement.dataset.scrollMode || 'document', owner: inspectScrollRegion(owner),
    issues, undeclared: undeclared.map(inspectScrollRegion), invalid: invalid.map(inspectScrollRegion) };
}

export function initScrollRuntime({ window: win = window, document: doc = document } = {}) {
  let frame = null;
  let warning = '';
  let contractDirty = true;
  const scrollAttributes = new Set(['data-scroll-owner', 'data-scroll-region', 'data-scroll-obstacle']);
  const shellFor = () => doc.getElementById('app-shell');
  const mainFor = () => doc.querySelector('[data-scroll-owner="main"]');
  const isElement = node => node?.nodeType === 1;
  const withinShell = node => {
    const shell = shellFor();
    if (!shell || !isElement(node)) return false;
    return node === shell || node.closest?.('#app-shell') === shell;
  };
  const isDeclaredRegion = node => isElement(node) && node.matches?.('[data-scroll-region]');
  const isObstacle = node => isElement(node) && node.matches?.('[data-scroll-obstacle]');
  const withinDeclaredRegion = node => isElement(node) && Boolean(node.closest?.('[data-scroll-region]'));
  const withinObstacle = node => isElement(node) && Boolean(node.closest?.('[data-scroll-obstacle]'));
  const hasScrollToken = node => isElement(node) && (
    node.matches?.('[data-scroll-owner], [data-scroll-region], [data-scroll-obstacle]')
      || Boolean(node.querySelector?.('[data-scroll-owner], [data-scroll-region], [data-scroll-obstacle]'))
  );
  const affectsLayout = record => {
    if (!record || !withinShell(record.target)) return false;
    const target = record.target;
    if (record.type === 'attributes') {
      if (!['class', 'hidden', 'open', ...scrollAttributes].includes(record.attributeName)) return false;
      if (scrollAttributes.has(record.attributeName)) return true;
      return target === shellFor() || target === mainFor() || isDeclaredRegion(target)
        || isObstacle(target) || withinDeclaredRegion(target) || withinObstacle(target);
    }
    if (record.type !== 'childList') return false;
    if (target === shellFor() || target === mainFor() || isDeclaredRegion(target)
      || isObstacle(target) || withinDeclaredRegion(target) || withinObstacle(target)) return true;
    return [...(record.addedNodes || []), ...(record.removedNodes || [])].some(hasScrollToken);
  };
  const affectsContract = record => {
    if (!affectsLayout(record)) return false;
    if (record.type === 'attributes') {
      return ['hidden', 'open', ...scrollAttributes].includes(record.attributeName)
        || record.target === shellFor() || record.target === mainFor()
        || isDeclaredRegion(record.target) || isObstacle(record.target)
        || withinDeclaredRegion(record.target) || withinObstacle(record.target);
    }
    return record.target === shellFor() || record.target === mainFor() || isDeclaredRegion(record.target)
      || isObstacle(record.target) || withinDeclaredRegion(record.target) || withinObstacle(record.target)
      || [...(record.addedNodes || []), ...(record.removedNodes || [])].some(hasScrollToken);
  };
  function refresh({ diagnose = true } = {}) {
    const shell = doc.getElementById('app-shell');
    const main = doc.querySelector('[data-scroll-owner="main"]');
    const root = doc.documentElement;
    const desktop = win.matchMedia('(min-width: 901px)').matches;
    // Re-evaluate the bounded shell after login/resize, including recovery
    // from document mode. Otherwise the fallback's auto height is permanent.
    root.dataset.scrollMode = main && shell && !shell.hidden && desktop ? 'main' : 'document';
    const height = parseFloat(win.getComputedStyle(root).getPropertyValue('--kc-viewport-height'));
    const available = root.dataset.viewportSource === 'measured' ? height : win.innerHeight;
    const box = shell?.getBoundingClientRect() || { height: 0 };
    root.dataset.scrollMode = main && shell && !shell.hidden && desktop
      && box.height > 0 && box.height <= available + 2
      && main.clientHeight > 0 && main.clientHeight <= available + 2
      && /auto|scroll|overlay/.test(win.getComputedStyle(main).overflowY) ? 'main' : 'document';
    if (!shell || shell.hidden) return;
    for (const region of [main, ...doc.querySelectorAll('[data-scroll-region]')].filter(Boolean)) {
      let top = 16;
      let bottom = 16;
      for (const obstacle of region.querySelectorAll('[data-scroll-obstacle]')) {
        const style = win.getComputedStyle(obstacle);
        if (!/sticky|fixed/.test(style.position) || !obstacle.getClientRects().length) continue;
        const size = obstacle.getBoundingClientRect().height;
        if (style.top !== 'auto') top = Math.max(top, (parseFloat(style.top) || 0) + size + 16);
        if (style.bottom !== 'auto') bottom = Math.max(bottom, (parseFloat(style.bottom) || 0) + size + 16);
      }
      region.style.setProperty('--kc-scroll-top', `${top}px`);
      region.style.setProperty('--kc-scroll-bottom', `${bottom}px`);
      if (region === main) {
        root.style.setProperty('--kc-scroll-top', `${top}px`);
        root.style.setProperty('--kc-scroll-bottom', `${bottom}px`);
      }
    }
    // Contract inspection is intentionally separate from geometry refresh. The explicit
    // inspector keeps the full diagnostic path; scheduled frames only inspect when a
    // scroll contract mutation or an explicit refresh requires it.
    if (diagnose) {
      const report = inspectScrollContract(doc, { scanUndeclared: false });
      if (win.matchMedia('(min-width: 901px)').matches && root.dataset.scrollMode !== 'main') report.issues.push('应用壳高度异常，已降级为页面滚动');
      const key = report.issues.join('|');
      if (key && key !== warning) win.console.warn('知识中心滚动契约异常', report);
      warning = key;
      contractDirty = false;
      return report;
    }
    return null;
  }
  const schedule = (records = [], { forceContract = false } = {}) => {
    const changes = Array.isArray(records) ? records : [];
    if (forceContract || changes.some(affectsContract)) contractDirty = true;
    if (!forceContract && changes.length && !changes.some(affectsLayout)) return;
    if (frame === null) frame = win.requestAnimationFrame(() => {
      frame = null;
      refresh({ diagnose: contractDirty });
    });
  };
  const focus = event => {
    const target = event.target;
    if (!target?.getBoundingClientRect) return;
    const owner = getScrollOwner(doc);
    const region = target.closest('[data-scroll-region]') || owner;
    if (!region) return;
    const box = region === doc.scrollingElement ? { top: 0, bottom: win.innerHeight } : region.getBoundingClientRect();
    const style = win.getComputedStyle(region);
    const targetBox = target.getBoundingClientRect();
    if (targetBox.top < box.top + (parseFloat(style.scrollPaddingTop) || 0)
      || targetBox.bottom > box.bottom - (parseFloat(style.scrollPaddingBottom) || 0)) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    }
  };
  const observer = new win.MutationObserver(records => schedule(records));
  observer.observe(doc.body, { subtree: true, childList: true, attributes: true,
    attributeFilter: ['class', 'hidden', 'open', ...scrollAttributes] });
  const forceSchedule = () => schedule([], { forceContract: true });
  win.addEventListener('kc-viewport-changed', forceSchedule);
  win.addEventListener('resize', forceSchedule);
  doc.addEventListener('focusin', focus);
  refresh({ diagnose: true });
  return { refresh, destroy() {
    observer.disconnect();
    if (frame !== null) win.cancelAnimationFrame(frame);
    win.removeEventListener('kc-viewport-changed', forceSchedule);
    win.removeEventListener('resize', forceSchedule);
    doc.removeEventListener('focusin', focus);
    delete doc.documentElement.dataset.scrollMode;
  } };
}
