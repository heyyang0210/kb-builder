// Decode only the top-level markdown string; never expose partial provenance JSON.
function previewMarkdown(raw) {
  let source = raw.trimStart();
  if (/^`{1,2}$/.test(source) || /^```(?:j(?:s(?:o(?:n)?)?)?)?\s*$/.test(source)) return '';
  if (source.startsWith('```json')) source = source.slice(7).trimStart();
  if (!source) return '';
  if (!source.startsWith('{')) return raw;
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{' || ch === '[') { depth++; continue; }
    if (ch === '}' || ch === ']') { depth--; continue; }
    if (ch !== '"') continue;
    const start = i++;
    for (; i < source.length; i++) {
      if (source[i] === '\\') { i++; continue; }
      if (source[i] === '"') break;
    }
    if (i >= source.length) return '';
    const token = source.slice(start, i + 1);
    if (depth !== 1 || token !== '"markdown"') continue;
    let rest = source.slice(i + 1);
    const prefix = rest.match(/^\s*:\s*"/);
    if (!prefix) continue;
    rest = rest.slice(prefix[0].length);
    let encoded = '';
    for (let k = 0; k < rest.length; k++) {
      if (rest[k] === '"') break;
      if (rest[k] === '\\') {
        if (k + 1 >= rest.length) break;
        if (rest[k + 1] === 'u') {
          const escape = rest.slice(k, k + 6);
          if (!/^\\u[0-9a-f]{4}$/i.test(escape)) break;
          encoded += escape; k += 5;
        } else { encoded += rest.slice(k, k + 2); k++; }
      } else encoded += rest[k];
    }
    try { return JSON.parse('"' + encoded + '"').replace(/[\uD800-\uDBFF]$/, ''); } catch (_) { return ''; }
  }
  return '';
}
module.exports = { previewMarkdown };
