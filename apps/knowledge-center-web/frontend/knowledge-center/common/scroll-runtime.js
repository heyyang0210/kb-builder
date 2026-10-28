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
  function refresh() {
    const shell = doc.getElementById('app-shell');
    const main = doc.querySelector('[data-scroll-owner="main"]');
    const root = doc.documentElement;
    const desktop = win.matchMedia('(min-width: 901px)').matches;
    // Re-evaluate the bounded shell after login/resize, including recovery
    // from document mode. Otherwise the fallback's auto height is permanent.
    root.dataset.scrollMode = main && shell && !shell.hidden && desktop ? 'main' : 'document';
    const height = parseFloat(win.getComputedStyle(root).getPropertyValue('--kc-viewport-height'));
    const available = root.dataset.viewportSource === 'measured' ? height : win.innerHeight;
    const box = shell?.getBoundingClientRect();
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
    // Full-tree geometry inspection is an explicit diagnostic, not a DOM-mutation hot path.
    const report = inspectScrollContract(doc, { scanUndeclared: false });
    if (win.matchMedia('(min-width: 901px)').matches && root.dataset.scrollMode !== 'main') report.issues.push('应用壳高度异常，已降级为页面滚动');
    const key = report.issues.join('|');
    if (key && key !== warning) win.console.warn('知识中心滚动契约异常', report);
    warning = key;
  }
  const schedule = () => { if (frame === null) frame = win.requestAnimationFrame(() => { frame = null; refresh(); }); };
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
  const observer = new win.MutationObserver(schedule);
  observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'open'] });
  win.addEventListener('kc-viewport-changed', schedule);
  win.addEventListener('resize', schedule);
  doc.addEventListener('focusin', focus);
  refresh();
  return { refresh, destroy() {
    observer.disconnect();
    if (frame !== null) win.cancelAnimationFrame(frame);
    win.removeEventListener('kc-viewport-changed', schedule);
    win.removeEventListener('resize', schedule);
    doc.removeEventListener('focusin', focus);
    delete doc.documentElement.dataset.scrollMode;
  } };
}
