// Native dynamic viewport first; old WebViews use a measured CSS token.
export function initViewportRuntime({ window: win = window, document: doc = document } = {}) {
  const root = doc.documentElement;
  const supportsDvh = Boolean(win.CSS?.supports?.('height', '100dvh'));
  const probe = doc.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;height:100dvh;width:0;';
  doc.body.append(probe);
  let frame = null;
  let lastHeight = 0;
  let lastViewportHeight = 0;
  function update() {
    const viewport = win.visualViewport;
    const height = viewport && Math.abs(viewport.scale - 1) < 0.01
      && Number.isFinite(viewport.height) && viewport.height > 0 ? viewport.height : win.innerHeight;
    if (!Number.isFinite(height) || height <= 0) return;
    const nativeHeight = probe.getBoundingClientRect().height;
    const fallback = !supportsDvh || Math.abs(nativeHeight - height) > 1;
    let changed = root.dataset.viewportSource !== (fallback ? 'measured' : 'native')
      || Math.abs(lastViewportHeight - height) > 1;
    if (changed) lastViewportHeight = height;
    if (fallback) {
      if (Math.abs(lastHeight - height) > 1) {
        root.style.setProperty('--kc-viewport-height', `${Math.round(height)}px`);
        lastHeight = height;
        changed = true;
      }
    } else {
      if (lastHeight) { root.style.removeProperty('--kc-viewport-height'); changed = true; }
      lastHeight = 0;
    }
    root.dataset.viewportSource = fallback ? 'measured' : 'native';
    if (changed) win.dispatchEvent(new win.Event('kc-viewport-changed'));
  }
  const schedule = () => { if (frame === null) frame = win.requestAnimationFrame(() => { frame = null; update(); }); };
  win.addEventListener('resize', schedule);
  win.addEventListener('orientationchange', schedule);
  win.visualViewport?.addEventListener('resize', schedule);
  update();
  return { update, destroy() {
    if (frame !== null) win.cancelAnimationFrame(frame);
    win.removeEventListener('resize', schedule);
    win.removeEventListener('orientationchange', schedule);
    win.visualViewport?.removeEventListener('resize', schedule);
    probe.remove();
    root.style.removeProperty('--kc-viewport-height');
    delete root.dataset.viewportSource;
  } };
}
