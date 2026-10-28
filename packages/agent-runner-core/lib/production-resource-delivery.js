const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { lexer, walkTokens } = require('marked');
const cheerio = require('cheerio');
const { imageReferences, imageType } = require('./source-image-resources');
const { extractMarkdownResources, GitLabConnectorError, MAX_FILE_BYTES } = require('./gitlab-connector');
const { CONFIG_PATHS } = require('./config-registry');

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = (code, message, status = 409) => { throw new GitLabConnectorError(code, message, status); };
const escapeAttribute = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const extensions = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };

// Keep raw HTML offsets while hiding Markdown text/code from the HTML parser.
// The complete inline HTML tree retains <code>/<pre> ancestry across tokens.
function htmlImageReferences(content) {
  const refs = []; let blockOffset = 0;
  for (const block of lexer(content)) {
    const start = content.indexOf(block.raw, blockOffset);
    if (start < 0) continue;
    blockOffset = start + block.raw.length;
    if (block.type === 'code') continue;
    let html = block.raw;
    if (block.type !== 'html') {
      const chars = Array.from({ length: block.raw.length }, () => ' ');
      const excluded = []; const tokens = [];
      walkTokens([block], token => {
        if (['code', 'codespan'].includes(token.type)) excluded.push(token.raw);
        if (token.type === 'html') tokens.push(token);
      });
      const spans = [];
      for (const raw of excluded) {
        let at = 0;
        while (raw && (at = block.raw.indexOf(raw, at)) >= 0) { spans.push([at, at + raw.length]); at += raw.length; }
      }
      let cursor = 0;
      for (const token of tokens) {
        let at = block.raw.indexOf(token.raw, cursor);
        while (at >= 0 && spans.some(([a, b]) => at >= a && at < b)) at = block.raw.indexOf(token.raw, at + token.raw.length);
        if (at < 0) continue;
        for (let i = at; i < at + token.raw.length; i++) chars[i] = block.raw[i];
        cursor = at + token.raw.length;
      }
      html = chars.join('');
    }
    const $ = cheerio.load(html, { sourceCodeLocationInfo: true }, false);
    $('img').each((_, element) => {
      const image = $(element);
      if (image.parents('pre, code, script, style').length) return;
      const location = element.sourceCodeLocation?.attrs?.src;
      if (location) refs.push({ start: start + location.startOffset, end: start + location.endOffset, href: image.attr('src'), html: true });
    });
  }
  return refs;
}

function createProductionResourceDelivery({ root, readAttachment, readSourceImage, policy = () => JSON.parse(fs.readFileSync(CONFIG_PATHS.contentRules, 'utf8')).productionDelivery }) {
  function prepare(document, revision, session, authorizePath) {
    const config = policy();
    if (!config || !/^[A-Za-z0-9_-]+$/.test(config.resourceDirectory) || ![config.maxCount, config.maxBytes, config.maxTotalBytes].every(value => Number.isSafeInteger(value) && value > 0) || config.maxBytes > MAX_FILE_BYTES) {
      fail('GITLAB_RESOURCE_POLICY_INVALID', '图片交付策略不可用', 503);
    }
    const pending = new Map(); const edits = []; const usedAttachments = new Set();
    let totalBytes = 0;
    const references = [...imageReferences(document.markdown), ...htmlImageReferences(document.markdown)];
    for (const ref of references) {
      if (!String(ref.href).startsWith('/knowledge-center/api/production/')) continue;
      const url = new URL(ref.href, 'http://platform.invalid');
      const attachment = url.pathname.match(/^\/knowledge-center\/api\/production\/attachments\/([^/]+)$/);
      const source = url.pathname.match(/^\/knowledge-center\/api\/production\/handbooks\/([^/]+)\/documents\/([^/]+)\/ai-sources\/images\/([a-f0-9]{64})$/);
      let bytes;
      if (attachment) {
        const id = decodeURIComponent(attachment[1]);
        if (url.search || url.hash || !revision.attachmentIds?.includes(id)) fail('ATTACHMENT_CONTEXT_MISMATCH', '图片不属于本次保存修订');
        const result = readAttachment(id, session);
        if (['handbookId', 'documentId', 'outlineVersionId', 'branch'].some(key => result.metadata[key] !== document[key])) fail('ATTACHMENT_CONTEXT_MISMATCH', '图片不属于当前文档上下文');
        if (result.metadata.kind !== 'image' || hash(result.buffer) !== result.metadata.digest) fail('GITLAB_RESOURCE_SNAPSHOT_CHANGED', '上传图片内容与保存摘要不一致');
        bytes = result.buffer; usedAttachments.add(id);
      } else if (source) {
        if (decodeURIComponent(source[1]) !== document.handbookId || decodeURIComponent(source[2]) !== document.documentId ||
            url.hash || ['outlineVersionId', 'branch'].some(key => url.searchParams.getAll(key).length !== 1 || url.searchParams.get(key) !== document[key]) ||
            [...url.searchParams.keys()].some(key => !['outlineVersionId', 'branch'].includes(key))) fail('GITLAB_RESOURCE_CONTEXT_MISMATCH', '来源图片与当前保存修订上下文不一致');
        const result = readSourceImage({ ...document, assetId: source[3] }, session);
        bytes = result.data;
        if (!Buffer.isBuffer(bytes) || hash(bytes) !== source[3]) fail('GITLAB_RESOURCE_SNAPSHOT_CHANGED', '来源图片内容与引用摘要不一致');
      } else fail('GITLAB_RESOURCE_DELIVERY_UNSUPPORTED', '不支持的站内图片引用', 422);
      const type = Buffer.isBuffer(bytes) ? imageType(bytes) : null;
      if (!type || !extensions[type]) fail('GITLAB_RESOURCE_TYPE_NOT_ALLOWED', '交付图片必须是有效的 PNG、JPEG、GIF 或 WebP', 415);
      if (!bytes.length || bytes.length > config.maxBytes) fail('GITLAB_RESOURCE_TOO_LARGE', '图片超出交付策略限制', 413);
      const contentDigest = hash(bytes);
      const resourcePath = path.posix.join(path.posix.dirname(document.filePath), config.resourceDirectory, `${contentDigest}${extensions[type]}`);
      authorizePath(resourcePath);
      if (!pending.has(resourcePath)) {
        totalBytes += bytes.length;
        if (pending.size >= config.maxCount || totalBytes > config.maxTotalBytes) fail('GITLAB_RESOURCE_TOO_LARGE', '图片数量或总大小超出交付策略限制', 413);
        pending.set(resourcePath, { bytes, resource: { path: resourcePath, size: bytes.length, contentDigest, delivery: 'create', snapshotVersion: config.version } });
      }
      const relative = path.posix.relative(path.posix.dirname(document.filePath), resourcePath);
      const alt = String(ref.alt || '图片').replace(/[\\\[\]<>\n\r]/g, ' ');
      edits.push({ ...ref, replacement: ref.html ? `src="${escapeAttribute(relative)}"` : `![${alt}](${relative})` });
    }
    if ((revision.attachmentIds || []).some(id => !usedAttachments.has(id))) fail('ATTACHMENT_DELIVERY_UNSUPPORTED', '存在未进入正文的图片或暂不支持交付的文档附件，请处理后重新保存', 422);
    let markdown = document.markdown;
    for (const edit of edits.sort((a, b) => b.start - a.start)) markdown = markdown.slice(0, edit.start) + edit.replacement + markdown.slice(edit.end);
    const referencesAfter = extractMarkdownResources(markdown, document.filePath);
    referencesAfter.forEach(ref => authorizePath(ref.path));
    const actualPaths = new Set(referencesAfter.map(ref => ref.path));
    if ([...pending.keys()].some(resourcePath => !actualPaths.has(resourcePath))) fail('GITLAB_RESOURCE_READBACK_FAILED', '图片语法未能安全改写，请调整正文引用');
    for (const { bytes, resource } of pending.values()) {
      fs.mkdirSync(root, { recursive: true });
      const file = path.join(root, resource.contentDigest);
      try { fs.writeFileSync(file, bytes, { flag: 'wx', mode: 0o600 }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
      const actual = fs.readFileSync(file);
      if (!actual.equals(bytes)) fail('GITLAB_RESOURCE_SNAPSHOT_CHANGED', '既有交付图片快照损坏');
    }
    return { markdown, managedResources: [...pending.values()].map(item => item.resource) };
  }

  function readFrozen(resource) {
    if (resource.delivery !== 'create' || !/^[a-f0-9]{64}$/.test(resource.contentDigest)) fail('GITLAB_RESOURCE_SNAPSHOT_CHANGED', '缺少有效的交付图片摘要');
    let bytes;
    try { bytes = fs.readFileSync(path.join(root, resource.contentDigest)); }
    catch (_) { fail('GITLAB_RESOURCE_SNAPSHOT_CHANGED', '审核交付图片快照缺失'); }
    if (bytes.length !== resource.size || hash(bytes) !== resource.contentDigest || !imageType(bytes)) fail('GITLAB_RESOURCE_SNAPSHOT_CHANGED', '审核交付图片快照不一致');
    return bytes;
  }
  return { prepare, readFrozen };
}

module.exports = { createProductionResourceDelivery, htmlImageReferences };
