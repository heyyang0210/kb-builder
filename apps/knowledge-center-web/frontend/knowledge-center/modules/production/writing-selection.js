// Never infer Markdown offsets from rendered text: repeated text and markup are ambiguous.
export function markdownRangeFromDOM(editor, element, selectionRange, markdown) {
  const root = element?.querySelector('.vditor-wysiwyg [contenteditable="true"]');
  if (!root || !selectionRange || !root.contains(selectionRange.startContainer) || !root.contains(selectionRange.endContainer)) return null;
  const convert = editor?.vditor?.lute?.VditorDOM2Md;
  if (!convert) return null;
  try {
    const clone = root.cloneNode(true);
    const locate = node => {
      const path = [];
      while (node !== root) { path.unshift([...node.parentNode.childNodes].indexOf(node)); node = node.parentNode; }
      return path.reduce((parent, index) => parent.childNodes[index], clone);
    };
    const marked = document.createRange();
    marked.setStart(locate(selectionRange.startContainer), selectionRange.startOffset);
    marked.setEnd(locate(selectionRange.endContainer), selectionRange.endOffset);
    const token = `WRITING${(globalThis.crypto?.randomUUID?.() || `${Date.now()}${Math.random().toString(36).slice(2)}`).replaceAll('-', '')}`;
    const startMarker = `${token}START`, endMarker = `${token}END`;
    const end = marked.cloneRange(); end.collapse(false); end.insertNode(document.createTextNode(endMarker));
    marked.collapse(true); marked.insertNode(document.createTextNode(startMarker));
    const result = convert.call(editor.vditor.lute, clone.innerHTML).replaceAll('\u00a0', ' ');
    const start = result.indexOf(startMarker), endIndex = result.indexOf(endMarker);
    if (start < 0 || endIndex < start || result.replace(startMarker, '').replace(endMarker, '') !== markdown) return null;
    return { start, end: endIndex - startMarker.length };
  } catch (_) { return null; }
}

export function retainWritingSelection(getContext) {
  let retained;
  const track = () => {
    const context = getContext();
    const selection = window.getSelection();
    if (context.element?.contains(selection?.anchorNode) && context.element.contains(selection?.focusNode) && selection.rangeCount) {
      retained = { editor: context.editor, range: selection.getRangeAt(0).cloneRange() };
    }
  };
  document.addEventListener('selectionchange', track);
  const read = () => {
    const context = getContext();
    if (!retained || retained.editor !== context.editor) return null;
    return markdownRangeFromDOM(context.editor, context.element, retained.range, context.editor.getValue());
  };
  read.dispose = () => document.removeEventListener('selectionchange', track);
  return read;
}
