const runtimes = new WeakMap();
const selector = 'details[data-dismissible-menu]';

// Only transient disclosures opt in; directory trees and editable panels stay open.
export function initDismissibleMenus(root = document) {
  if (runtimes.has(root)) return runtimes.get(root);
  const openMenus = () => [...root.querySelectorAll(`${selector}[open]`)];
  const outside = event => {
    // Switch on click so closing a flow-positioned panel cannot move the next
    // summary between pointerdown and the browser's native activation.
    if (event.type === 'pointerdown' && event.target.closest?.('summary')?.parentElement?.matches(selector)) return;
    const path = event.composedPath();
    openMenus().forEach(menu => {
      if (!path.includes(menu)) menu.open = false;
    });
  };
  const click = event => {
    outside(event);
    const summary = event.target.closest?.('summary');
    const menu = summary?.parentElement;
    if (menu?.matches(selector) && !menu.open) {
      openMenus().forEach(other => { if (other !== menu) other.open = false; });
    }
  };
  const toggle = event => {
    const menu = event.target;
    if (!menu.matches?.(selector)) return;
    if (menu.open) {
      openMenus().forEach(other => { if (other !== menu) other.open = false; });
    } else {
      menu.dispatchEvent(new CustomEvent('dismissible-menu-close', { bubbles: true }));
    }
  };
  const keydown = event => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    // A nested combobox owns its Escape; do not dismiss its parent disclosure.
    if (event.target.closest?.('[data-searchable-combobox]')?.querySelector('[aria-expanded="true"]')) return;
    const dialog = root.querySelector('dialog[open]');
    const menus = openMenus().filter(menu => !dialog || menu.closest('dialog') === dialog);
    const menu = menus.find(item => item.contains(event.target)) || menus.at(-1);
    if (!menu) return;
    menu.open = false;
    menu.querySelector(':scope > summary')?.focus();
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const listeners = [['pointerdown', outside], ['click', click], ['toggle', toggle], ['keydown', keydown]];
  listeners.forEach(([type, handler]) => root.addEventListener(type, handler, true));
  const runtime = { destroy() {
    listeners.forEach(([type, handler]) => root.removeEventListener(type, handler, true));
    runtimes.delete(root);
  } };
  runtimes.set(root, runtime);
  return runtime;
}
