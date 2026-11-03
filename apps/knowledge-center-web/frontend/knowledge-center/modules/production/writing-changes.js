// Keep every original newline: assembling decisions must preserve unchanged Markdown byte for byte.
export function writingChanges(before, after) {
  if (before === after) return [{ type: 'equal', text: before }];
  const lines = text => text.match(/[^\n]*\n|[^\n]+$/g) || [];
  const a = lines(before), b = lines(after);
  let prefix = 0, suffix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - suffix - 1] === b[b.length - suffix - 1]) suffix++;
  const left = a.slice(prefix, a.length - suffix), right = b.slice(prefix, b.length - suffix);
  const segments = [];
  const add = (type, text) => {
    if (!text) return;
    if (segments.at(-1)?.type === type) segments.at(-1).text += text;
    else segments.push({ type, text });
  };
  add('equal', a.slice(0, prefix).join(''));
  // Bound the LCS matrix. Large changes remain reviewable as a single whole block.
  if ((left.length + 1) * (right.length + 1) > 250000) {
    add('remove', left.join('')); add('add', right.join(''));
  } else {
    const dp = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1));
    for (let i = left.length - 1; i >= 0; i--) for (let j = right.length - 1; j >= 0; j--)
      dp[i][j] = left[i] === right[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let i = 0, j = 0;
    while (i < left.length || j < right.length) {
      if (i < left.length && j < right.length && left[i] === right[j]) { add('equal', left[i++]); j++; }
      else if (i < left.length && (j === right.length || dp[i + 1][j] >= dp[i][j + 1])) add('remove', left[i++]);
      else add('add', right[j++]);
    }
  }
  add('equal', suffix ? a.slice(a.length - suffix).join('') : '');
  const result = [];
  for (const segment of segments) {
    if (segment.type === 'equal') result.push(segment);
    else {
      if (result.at(-1)?.type !== 'change') result.push({ type: 'change', before: '', after: '', decision: 'pending' });
      result.at(-1)[segment.type === 'remove' ? 'before' : 'after'] += segment.text;
    }
  }
  return result;
}

export const assembleWritingChanges = segments => segments.map(segment => segment.type === 'equal' ? segment.text : segment.decision === 'rejected' ? segment.before : segment.after).join('');
