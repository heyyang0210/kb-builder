const boundary = (text, offset) => Number.isSafeInteger(offset) && offset >= 0 && offset <= text.length
  && !(offset > 0 && offset < text.length && /[\uD800-\uDBFF]/.test(text[offset - 1]) && /[\uDC00-\uDFFF]/.test(text[offset]));
const validRange = (text, item) => item && boundary(text, item.start) && boundary(text, item.end) && item.end > item.start;
const inference = (start, end, issue) => ({ start, end, kind: 'model_inference', verification: 'unverified', sourceIds: [], evidence: [], ...(issue ? { issue } : {}) });

function parseGenerated(content, sources, maxSegments = 512) {
  let payload;
  const fenced = content.trim().match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  const structured = fenced ? fenced[1] : content;
  try { payload = JSON.parse(structured); } catch (_) {
    if (/^\s*\{\s*"(?:markdown|provenance)"\s*:/.test(structured)) throw new Error('INVALID_GENERATION_ENVELOPE');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || (!Object.hasOwn(payload, 'markdown') && !Object.hasOwn(payload, 'provenance'))) {
    return { markdown: content, provenance: [inference(0, content.length)], format: 'markdown' };
  }
  if (typeof payload.markdown !== 'string' || !payload.markdown.trim() || !Array.isArray(payload.provenance)
    || payload.provenance.length > maxSegments) throw new Error('INVALID_GENERATION_ENVELOPE');
  const markdown = payload.markdown;
  const claims = payload.provenance.slice().sort((a, b) => (a?.start ?? -1) - (b?.start ?? -1));
  // Reject ambiguous geometry rather than attaching an apparently precise source to the wrong text.
  let cursor = 0; const provenance = [];
  for (const claim of claims) {
    if (!validRange(markdown, claim) || claim.start < cursor) throw new Error('INVALID_GENERATION_ENVELOPE');
    if (claim.start > cursor) provenance.push(inference(cursor, claim.start));
    const references = Array.isArray(claim.evidence) ? claim.evidence : [];
    if (references.length > maxSegments) throw new Error('INVALID_GENERATION_ENVELOPE');
    const evidence = references.map(item => {
      const source = sources.find(source => source.sourceId === item?.sourceId);
      return source && validRange(source.content, item) ? { sourceId: source.sourceId, start: item.start, end: item.end } : null;
    });
    const validEvidence = evidence.length > 0 && evidence.every(Boolean);
    const quoteMatches = validEvidence && evidence.length === 1 && markdown.slice(claim.start, claim.end)
      === sources.find(source => source.sourceId === evidence[0].sourceId).content.slice(evidence[0].start, evidence[0].end);
    if ((claim.kind === 'direct_quote' && quoteMatches) || (claim.kind === 'source_summary' && validEvidence)) {
      provenance.push({ start: claim.start, end: claim.end, kind: claim.kind,
        verification: claim.kind === 'direct_quote' ? 'text_matched' : 'unverified',
        sourceIds: [...new Set(evidence.map(item => item.sourceId))], evidence });
    } else provenance.push(inference(claim.start, claim.end, claim.kind === 'model_inference' ? undefined : 'SOURCE_CLAIM_UNVERIFIED'));
    cursor = claim.end;
  }
  if (cursor < markdown.length) provenance.push(inference(cursor, markdown.length));
  return { markdown, provenance, format: 'json-v1' };
}

function outsideRange(provenance, start, end, replacementLength) {
  const delta = replacementLength - (end - start); const kept = [];
  const clip = (item, from, to, shift) => {
    const result = { ...structuredClone(item), start: from + shift, end: to + shift };
    if (item.kind === 'direct_quote') result.evidence = (item.evidence || []).map(ref => ({
      ...ref, start: ref.start + from - item.start, end: ref.start + to - item.start,
    }));
    return result;
  };
  for (const item of provenance || []) {
    if (item.start < start) kept.push(clip(item, item.start, Math.min(item.end, start), 0));
    if (item.end > end) kept.push(clip(item, Math.max(item.start, end), item.end, delta));
  }
  return kept.filter(item => item.end > item.start);
}

function humanChanges(original, markdown, provenance, kind = 'human_edit') {
  if (original === markdown) return structuredClone(provenance || []);
  let start = 0;
  while (start < original.length && start < markdown.length && original[start] === markdown[start]) start++;
  while (!boundary(original, start) || !boundary(markdown, start)) start--;
  let tail = 0;
  while (tail < original.length - start && tail < markdown.length - start
    && original[original.length - tail - 1] === markdown[markdown.length - tail - 1]) tail++;
  while (!boundary(original, original.length - tail) || !boundary(markdown, markdown.length - tail)) tail--;
  const nextEnd = markdown.length - tail;
  const result = outsideRange(provenance, start, original.length - tail, nextEnd - start);
  if (nextEnd > start) result.push({ start, end: nextEnd, kind, verification: kind === 'human_edit' ? 'needs_revalidation' : 'unverified', sourceIds: [], evidence: [] });
  return result.sort((a, b) => a.start - b.start);
}

module.exports = { parseGenerated, outsideRange, humanChanges };
