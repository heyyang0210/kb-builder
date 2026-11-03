// Resolve display URLs without rewriting the document's portable Markdown links.
export function repositoryImageURL(href, filePath, context = {}) {
  const target = String(href || '');
  if (!target || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(target) || !context.handbookId || !filePath) return null;
  let path;
  try { path = decodeURIComponent(target.split('#', 1)[0].split('?', 1)[0]); } catch (_) { return null; }
  const parts = filePath.split('/'); parts.pop();
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!parts.length) return null; parts.pop(); } else parts.push(part);
  }
  return `/knowledge-center/api/gitlab/handbooks/${encodeURIComponent(context.handbookId)}/file?ref=${encodeURIComponent(context.branch || '')}&language=${encodeURIComponent(context.language || 'zh')}&path=${encodeURIComponent(parts.join('/'))}&raw=1`;
}

export function observeRepositoryImages(element, filePath, context) {
  const previews = new WeakMap();
  const update = image => {
    const url = repositoryImageURL(image.getAttribute('src'), filePath, context);
    const previous = previews.get(image);
    if (url) {
      const value = `${url} 1x`;
      if (!previous) previews.set(image, { original: image.getAttribute('srcset'), value });
      else previous.value = value;
      if (image.getAttribute('srcset') !== value) image.setAttribute('srcset', value);
    } else if (previous) {
      if (previous.original === null) image.removeAttribute('srcset'); else image.setAttribute('srcset', previous.original);
      previews.delete(image);
    }
  };
  const scan = node => {
    if (node.nodeType !== 1) return;
    if (node.matches('img')) update(node);
    node.querySelectorAll('img').forEach(update);
  };
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') update(record.target);
      else record.addedNodes.forEach(scan);
    }
  });
  observer.observe(element, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
  scan(element);
  return () => observer.disconnect();
}
