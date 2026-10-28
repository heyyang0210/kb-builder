const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { lexer, walkTokens } = require('marked');
const { readRemoteResource } = require('./production-web-reference');
const { AGENT_RUNNER_RUNTIME_ROOT } = require('./repo-paths');
const { CONFIG_PATHS } = require('./config-registry');

const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const policyFor = config => config.images || JSON.parse(fs.readFileSync(CONFIG_PATHS.contentRules, 'utf8')).productionAI.sources.images;

// Do not trust a remote Content-Type, including authenticated connector responses.
function imageType(data) {
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (data.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return 'image/jpeg';
  if (['GIF87a', 'GIF89a'].includes(data.subarray(0, 6).toString())) return 'image/gif';
  if (data.length >= 12 && data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

// Marked supplies syntax and reference-link resolution; only replace actual image
// tokens, preserving code examples, raw HTML and all surrounding Markdown.
function imageReferences(content) {
  const refs = []; let blockOffset = 0;
  for (const block of lexer(content)) {
    const start = content.indexOf(block.raw, blockOffset);
    if (start < 0) continue;
    blockOffset = start + block.raw.length;
    if (['code', 'html'].includes(block.type)) continue;
    const excluded = []; const images = [];
    walkTokens([block], token => {
      if (['code', 'codespan', 'html'].includes(token.type)) excluded.push(token.raw);
      if (token.type === 'image') images.push(token);
    });
    const spans = [];
    for (const raw of excluded) {
      if (!raw) continue;
      let offset = 0, at;
      while ((at = block.raw.indexOf(raw, offset)) >= 0) { spans.push([at, at + raw.length]); offset = at + raw.length; }
    }
    let cursor = 0;
    for (const token of images) {
      let at = block.raw.indexOf(token.raw, cursor);
      while (at >= 0 && spans.some(([a, b]) => at >= a && at < b)) at = block.raw.indexOf(token.raw, at + token.raw.length);
      if (at < 0) continue;
      refs.push({ start: start + at, end: start + at + token.raw.length, href: token.href, alt: token.text });
      cursor = at + token.raw.length;
    }
  }
  return refs;
}

function createSourceImageResources({ root = path.join(AGENT_RUNNER_RUNTIME_ROOT, 'handbook-production', 'source-images') } = {}) {
  async function materialize(document, snapshot, config) {
    const policy = policyFor(config);
    const references = imageReferences(document.content);
    const supplied = new Map((document.imageResources || []).map(item => [item.reference, item]));
    const byHref = new Map(); const resources = []; const edits = [];
    let totalBytes = 0;
    const deadline = Date.now() + policy.timeoutMs;
    for (const ref of references) {
      let resource = byHref.get(ref.href);
      if (!resource) {
        resource = { referenceId: `image-${digest(ref.href).slice(0, 24)}`, status: 'failed' };
        byHref.set(ref.href, resource); resources.push(resource);
        try {
          if (resources.length > policy.maxCount) throw Object.assign(new Error(), { code: 'AI_SOURCE_IMAGE_LIMIT' });
          if (Date.now() >= deadline || totalBytes >= policy.maxTotalBytes) throw Object.assign(new Error(), { code: 'AI_SOURCE_IMAGE_LIMIT' });
          let data;
          const embedded = supplied.get(ref.href);
          if (ref.href.startsWith('source-image:')) {
            if (embedded?.status !== 'ready' || typeof embedded.dataBase64 !== 'string') throw new Error();
            if (embedded.dataBase64.length > Math.ceil(policy.maxBytes / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(embedded.dataBase64)) throw new Error();
            data = Buffer.from(embedded.dataBase64, 'base64');
          } else {
            // Authenticated connectors must not fall back to anonymous fetching.
            if (document.authenticatedImages) throw new Error();
            const url = new URL(ref.href, document.locator);
            const remote = await readRemoteResource(url.href, { ...config, timeoutMs: Math.max(1, deadline - Date.now()), maxBytes: Math.min(policy.maxBytes, policy.maxTotalBytes - totalBytes) }, policy.contentTypes);
            data = remote.data;
          }
          const contentType = imageType(data);
          if (!contentType || !policy.contentTypes.includes(contentType)) throw Object.assign(new Error(), { code: 'AI_SOURCE_IMAGE_FORMAT' });
          if (!data.length || data.length > policy.maxBytes || totalBytes + data.length > policy.maxTotalBytes) throw Object.assign(new Error(), { code: 'AI_SOURCE_IMAGE_LIMIT' });
          const contentDigest = digest(data);
          fs.mkdirSync(root, { recursive: true });
          const file = path.join(root, contentDigest);
          try { fs.writeFileSync(file, data, { flag: 'wx', mode: 0o600 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
          totalBytes += data.length;
          const params = new URLSearchParams({ outlineVersionId: snapshot.context.outlineVersionId, branch: snapshot.context.branch });
          const url = `/knowledge-center/api/production/handbooks/${encodeURIComponent(snapshot.context.handbookId)}/documents/${encodeURIComponent(snapshot.context.documentId)}/ai-sources/images/${contentDigest}?${params}`;
          Object.assign(resource, { status: 'ready', assetId: contentDigest, contentDigest, contentType, bytes: data.length, url });
        } catch (error) {
          // Never expose upstream URLs, signed query strings or provider errors.
          resource.errorCode = ['AI_SOURCE_IMAGE_LIMIT', 'AI_SOURCE_IMAGE_FORMAT'].includes(error.code) ? error.code : 'AI_SOURCE_IMAGE_UNAVAILABLE';
        }
      }
      const alt = String(ref.alt || '图片').replace(/[\[\]<>\n\r]/g, ' ');
      edits.push({ ...ref, replacement: resource.status === 'ready' ? `![${alt}](${resource.url})` : `[图片未能读取：${alt}]` });
    }
    let content = document.content;
    for (const edit of edits.reverse()) content = content.slice(0, edit.start) + edit.replacement + content.slice(edit.end);
    return { content, imageResources: resources, imagePolicyVersion: policy.version };
  }

  function read(resource) {
    if (!/^[a-f0-9]{64}$/.test(resource.assetId)) throw new Error('图片标识无效');
    const data = fs.readFileSync(path.join(root, resource.assetId));
    if (digest(data) !== resource.contentDigest || imageType(data) !== resource.contentType) throw new Error('图片快照校验失败');
    return { data, contentType: resource.contentType };
  }
  return { materialize, read };
}

module.exports = { createSourceImageResources, imageType, imageReferences, policyFor };
