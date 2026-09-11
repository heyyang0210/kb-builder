export function commentPath(anchor, task, tree = []) {
  if (!anchor) return '';
  if (anchor.path) return anchor.path;
  const operation = (task?.candidate?.operations || []).find(op => op.documentId === anchor.documentId);
  if (operation?.path) return operation.path;
  const index = task?.target?.documentIds?.indexOf(anchor.documentId) ?? -1;
  const path = index >= 0 ? (task.target.documentPaths || task.target.paths || [])[index] : '';
  return path || (tree.some(item => item.path === anchor.documentId) ? anchor.documentId : '');
}

export function textPosition(text, anchor) {
  const quote = anchor?.selectedText;
  if (!quote) return null;
  const start = anchor.charRange?.startChar;
  if (anchor.textScope === 'rendered_body' && Number.isInteger(start) && text.slice(start, start + quote.length) === quote) return [start, start + quote.length];
  const matches = [];
  for (let at = text.indexOf(quote); at >= 0; at = text.indexOf(quote, at + 1)) {
    if (anchor.contextBefore && !text.slice(0, at).endsWith(anchor.contextBefore)) continue;
    if (anchor.contextAfter && !text.slice(at + quote.length).startsWith(anchor.contextAfter)) continue;
    matches.push([at, at + quote.length]);
  }
  return matches.length === 1 ? matches[0] : null;
}

export function bodyNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) if (!walker.currentNode.parentElement.closest('.db-code-toolbar,button')) nodes.push(walker.currentNode);
  return nodes;
}

export function highlightAnchor(root, anchor) {
  const nodes = bodyNodes(root);
  const position = textPosition(nodes.map(node => node.textContent).join(''), anchor);
  if (!position) return false;
  const range = document.createRange();
  let offset = 0, started = false;
  for (const node of nodes) {
    const end = offset + node.length;
    if (!started && position[0] < end) { range.setStart(node, position[0] - offset); started = true; }
    if (started && position[1] <= end) { range.setEnd(node, position[1] - offset); break; }
    offset = end;
  }
  if (!started) return false;
  const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  range.startContainer.parentElement.scrollIntoView({ block: 'center' });
  if (globalThis.CSS?.highlights && globalThis.Highlight) CSS.highlights.set('review-anchor', new Highlight(range));
  return true;
}
import { marked } from '../../common/vendor/marked.esm.js';

export function legacyQuote(anchor, task, markdown) {
  const operation = (task?.candidate?.operations || []).find(op => op.documentId === anchor.documentId && op.nodeId === anchor.nodeId);
  if (['delete', 'remove'].includes(operation?.type)) return { deleted: true };
  const line = anchor.lineRange?.startLine ?? anchor.lineRange?.start;
  let offset = 1;
  const token = marked.lexer(String(markdown || '')).find(item => {
    const start = offset;
    offset += (item.raw.match(/\n/g) || []).length;
    return Number.isInteger(line) && start <= line && line < offset && item.type !== 'space';
  });
  const source = token?.raw || operation?.after?.content;
  if (!source) return null;
  // Detached parsed document: never mount the source HTML or execute it.
  const doc = new DOMParser().parseFromString(marked.parse(source), 'text/html');
  doc.querySelectorAll('script,style').forEach(node => node.remove());
  const quote = doc.body.textContent.trim();
  return quote ? { selectedText: quote } : null;
}
