#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const cheerio = require('cheerio');
const { lexer, walkTokens } = require('marked');
const { contextKey } = require('../../packages/agent-runner-core/lib/handbook-production-service');
const { imageType, imageReferences } = require('../../packages/agent-runner-core/lib/source-image-resources');
const { timeoutMs } = require('../../config/knowledge-center/production-reference-audit.json');
const hash = value => createHash('sha256').update(value).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const attachmentPrefix = '/knowledge-center/api/production/attachments/';
const sourceImagePath = /^\/knowledge-center\/api\/production\/handbooks\/[^/]+\/documents\/[^/]+\/ai-sources\/images\/([^/?#]+)/;

function htmlImageLinks(html) {
  const links = []; let uncheckedSrcset = 0;
  cheerio.load(html)('img').each((_, node) => {
    const attrs = node.attribs || {};
    const srcset = attrs['data-srcset'] || attrs.srcset || '';
    const candidates = srcset.split(',').map(value => value.trim()).filter(Boolean);
    if (candidates.length > 1) uncheckedSrcset += candidates.length - 1;
    const link = attrs.src || attrs['data-src'] || attrs['data-original'] || candidates[0]?.split(/\s+/)[0];
    if (link) links.push(link);
  });
  return { links, uncheckedSrcset };
}

function markdownImageLinks(markdown) {
  const links = imageReferences(markdown).map(item => item.href);
  walkTokens(lexer(markdown), token => {
    if (token.type === 'html') links.push(...htmlImageLinks(token.raw).links);
  });
  return links;
}

async function inventory(base, { attachmentRoot, sourceImageRoot } = {}) {
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw Error('INVALID_STORAGE_URL');
  const response = await fetch(new URL('/v1/export', url), { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
  const exported = await response.json();
  if (response.status !== 200 || exported.exportSchemaVersion !== 1 || !Array.isArray(exported.records)) throw Error('INVALID_EXPORT');
  const selected = exported.records.filter(r => ['handbook-production', 'production-ai-artifacts', 'incremental'].includes(r.namespace) && r.key === 'state' && !r.deleted);
  const select = namespace => {
    const rows = selected.filter(r => r.namespace === namespace);
    if (rows.length !== 1 || !object(rows[0].payload) || !Number.isSafeInteger(rows[0].revision) || !digest(rows[0].sha256)) throw Error('INVALID_AGGREGATE');
    return rows[0].payload;
  };
  const state = select('handbook-production');
  const artifactState = select('production-ai-artifacts');
  const incrementalState = select('incremental');
  for (const field of ['drafts', 'attachments', 'aiSources', 'aiJobs']) {
    if (state[field] !== undefined && !object(state[field])) throw Error('INVALID_COLLECTION');
  }
  if (!Array.isArray(state.reviewBatches) || !object(artifactState.artifacts) || !Array.isArray(incrementalState.tasks)) throw Error('INVALID_COLLECTION');
  const report = { schemaVersion: 4, scope: 'production_content_attachments_source_images_links_and_delivery_images', observedAt: new Date().toISOString(), observationOnly: true,
    manifestDigest: hash(JSON.stringify(selected.map(r => [r.namespace, r.revision, r.sha256]).sort())),
    aggregates: selected.map(r => ({ namespace: r.namespace, revision: r.revision, sha256: r.sha256 })),
    counts: { drafts: 0, revisions: 0, currentRevisions: 0, historicalRevisions: 0, sources: 0, jobs: 0,
      artifacts: 0, embeddedArtifacts: 0, unreferencedArtifacts: 0, attachments: 0, reviewBatches: state.reviewBatches.length, incrementalTasks: incrementalState.tasks.length },
    content: {}, issues: [], physical: { status: 'not_checked', files: 0, bytes: 0, missing: 0, unreferenced: 0 },
    sourceImages: { readyReferences: 0, failedReferences: 0, uniqueAssets: 0, declaredBytes: 0,
      referencesByLocation: { sources: 0, jobs: 0, revisions: 0 },
      physical: { status: 'not_checked', files: 0, bytes: 0, missing: 0, unreferenced: 0 } },
    deliveryImages: { references: 0, uniqueAssets: 0, declaredBytes: 0,
      physical: { status: 'not_checked', files: 0, bytes: 0, missing: 0, unreferenced: 0 } },
    imageLinks: { byLocation: { revisions: 0, htmlSnapshots: 0, sources: 0, jobs: 0 },
      attachment: 0, sourceImage: 0, external: 0, embedded: 0, relative: 0, unsafe: 0, uncheckedSrcsetCandidates: 0 },
    unchecked: ['legacy_agent_outputs', 'runtime_storage_mode', 'lob_and_transaction_snapshot', 'external_image_bytes_and_availability', 'repository_relative_resource_bytes', 'remaining_srcset_candidates', 'delivery_image_backup_recovery_and_gc'],
    logicalPassed: false, complete: false, passed: false };
  const issue = (code, id) => report.issues.push({ code, idHash: hash(String(id)) });
  const groups = new Map();
  const measure = (kind, id, text, expected) => {
    const stats = report.content[kind] ||= { count: 0, bytes: 0, maxBytes: 0, digestMismatches: 0, duplicateGroups: 0, duplicateItems: 0 };
    stats.count++;
    if (typeof text !== 'string') { issue('INVALID_CONTENT', id); return; }
    const bytes = Buffer.byteLength(text, 'utf8');
    stats.bytes += bytes; stats.maxBytes = Math.max(stats.maxBytes, bytes);
    const actual = hash(text);
    if (!digest(expected) || actual !== expected) { stats.digestMismatches++; issue('CONTENT_DIGEST_MISMATCH', id); }
    if (!groups.has(kind)) groups.set(kind, new Map());
    const group = groups.get(kind); group.set(actual, (group.get(actual) || 0) + 1);
  };
  const drafts = new Map();
  const attachments = state.attachments || {};
  const scanTargets = [];
  for (const [key, draft] of Object.entries(state.drafts || {})) {
    report.counts.drafts++;
    if (!object(draft) || typeof draft.draftId !== 'string' || !Array.isArray(draft.revisions)) { issue('INVALID_DRAFT', key); continue; }
    if (drafts.has(draft.draftId)) issue('DUPLICATE_DRAFT_ID', draft.draftId);
    try { if (contextKey(draft.context) !== key) issue('DRAFT_CONTEXT_KEY_MISMATCH', key); }
    catch { issue('INVALID_DRAFT_CONTEXT', key); }
    const revisions = new Map(); drafts.set(draft.draftId, revisions);
    for (const revision of draft.revisions) {
      report.counts.revisions++;
      if (!object(revision) || typeof revision.revisionId !== 'string') { issue('INVALID_REVISION', key); continue; }
      const id = `${draft.draftId}/${revision.revisionId}`;
      if (revisions.has(revision.revisionId)) issue('DUPLICATE_REVISION_ID', id);
      revisions.set(revision.revisionId, revision);
      if (revision.revisionId === draft.currentRevisionId) report.counts.currentRevisions++;
      else report.counts.historicalRevisions++;
      measure('revisionMarkdown', id, revision.markdown, revision.contentDigest);
      if (typeof revision.markdown === 'string') scanTargets.push({ text: revision.markdown, location: 'revisions', id, kind: 'markdown' });
      if (typeof revision.htmlSnapshot === 'string') {
        const stats = report.content.htmlSnapshot ||= { count: 0, bytes: 0, maxBytes: 0 };
        const bytes = Buffer.byteLength(revision.htmlSnapshot); stats.count++; stats.bytes += bytes; stats.maxBytes = Math.max(stats.maxBytes, bytes);
        scanTargets.push({ text: revision.htmlSnapshot, location: 'htmlSnapshots', id, kind: 'html' });
      }
      if (!Array.isArray(revision.attachmentIds)) issue('INVALID_ATTACHMENT_REFERENCES', id);
      else for (const attachmentId of revision.attachmentIds) if (!Object.hasOwn(attachments, attachmentId)) issue('MISSING_REVISION_ATTACHMENT', `${id}/${attachmentId}`);
    }
    if (!revisions.has(draft.currentRevisionId)) issue('MISSING_CURRENT_REVISION', draft.draftId);
    if (draft.reviewRevisionIds !== undefined && !Array.isArray(draft.reviewRevisionIds)) issue('INVALID_REVIEW_REFERENCES', draft.draftId);
    else for (const id of draft.reviewRevisionIds || []) if (!revisions.has(id)) issue('MISSING_REVIEW_REVISION', `${draft.draftId}/${id}`);
  }
  for (const batch of state.reviewBatches) {
    if (!object(batch) || !Array.isArray(batch.documents)) { issue('INVALID_REVIEW_BATCH', 'batch'); continue; }
    for (const doc of batch.documents) if (!object(doc) || !drafts.get(doc.draftId)?.has(doc.draftRevisionId)) issue('MISSING_BATCH_REVISION', `${doc?.draftId}/${doc?.draftRevisionId}`);
  }
  for (const [id, source] of Object.entries(state.aiSources || {})) {
    report.counts.sources++;
    measure('sourceContent', id, source?.content, source?.contentDigest);
    if (typeof source?.content === 'string') scanTargets.push({ text: source.content, location: 'sources', id, kind: 'markdown' });
  }
  const artifacts = artifactState.artifacts;
  const referencedArtifacts = new Set();
  const measureArtifact = (id, artifact) => {
    let serialized;
    if (object(artifact) && Object.hasOwn(artifact, 'value')) serialized = JSON.stringify(artifact.value);
    measure('artifactValue', id, serialized, artifact?.digest);
    if (artifact?.artifactId !== id) issue('ARTIFACT_ID_MISMATCH', id);
  };
  for (const [id, artifact] of Object.entries(artifacts)) { report.counts.artifacts++; measureArtifact(id, artifact); }
  for (const [id, job] of Object.entries(state.aiJobs || {})) {
    report.counts.jobs++;
    if (!object(job)) { issue('INVALID_JOB', id); continue; }
    measure('jobOriginalMarkdown', id, job.originalMarkdown, job.originalDigest);
    if (typeof job.originalMarkdown === 'string') scanTargets.push({ text: job.originalMarkdown, location: 'jobs', id, kind: 'markdown' });
    const records = job.artifacts?.records;
    if (records !== undefined && !object(records)) { issue('INVALID_ARTIFACT_REFERENCES', id); continue; }
    for (const [stageId, reference] of Object.entries(records || {})) {
      if (!object(reference) || typeof reference.artifactId !== 'string') { issue('INVALID_ARTIFACT_REFERENCE', id); continue; }
      const artifactId = reference.artifactId;
      const stored = Object.hasOwn(artifacts, artifactId) ? artifacts[artifactId] : null;
      const embedded = !stored && Object.hasOwn(reference, 'value');
      const actual = stored || (embedded ? reference : null);
      if (stored) referencedArtifacts.add(artifactId);
      if (embedded) { report.counts.embeddedArtifacts++; measureArtifact(artifactId, reference); }
      if (!actual) issue('MISSING_JOB_ARTIFACT', `${id}/${artifactId}`);
      else if (stageId !== reference.stageId || actual.stageId !== reference.stageId || actual.contractVersion !== reference.contractVersion || actual.digest !== reference.digest || actual.artifactId !== artifactId) issue('ARTIFACT_REFERENCE_MISMATCH', `${id}/${artifactId}`);
    }
  }
  report.counts.unreferencedArtifacts = Object.keys(artifacts).length - referencedArtifacts.size;
  for (const [kind, group] of groups) for (const count of group.values()) if (count > 1) { report.content[kind].duplicateGroups++; report.content[kind].duplicateItems += count - 1; }
  report.counts.attachments = Object.keys(attachments).length;
  const stats = report.content.attachmentMetadata = { count: report.counts.attachments, bytes: 0, maxBytes: 0 };
  for (const [id, item] of Object.entries(attachments)) {
    if (!object(item) || !Number.isSafeInteger(item.size) || item.size < 0 || !digest(item.digest)) issue('INVALID_ATTACHMENT_METADATA', id);
    else { stats.bytes += item.size; stats.maxBytes = Math.max(stats.maxBytes, item.size); }
  }
  const images = {};
  const collectImages = (source, location, id) => {
    if (!object(source)) { issue('INVALID_IMAGE_SOURCE_SNAPSHOT', id); return; }
    if (source.imageResources === undefined) return;
    if (!Array.isArray(source.imageResources)) { issue('INVALID_SOURCE_IMAGE_REFERENCES', id); return; }
    for (const [index, resource] of source.imageResources.entries()) {
      const refId = `${location}/${id}/${index}`;
      report.sourceImages.referencesByLocation[location]++;
      if (resource?.status === 'failed') { report.sourceImages.failedReferences++; continue; }
      if (!object(resource) || resource.status !== 'ready') { issue('INVALID_SOURCE_IMAGE_METADATA', refId); continue; }
      report.sourceImages.readyReferences++;
      if (!digest(resource.assetId) || resource.assetId !== resource.contentDigest ||
          !Number.isSafeInteger(resource.bytes) || resource.bytes < 0 ||
          !['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(resource.contentType)) {
        issue('INVALID_SOURCE_IMAGE_METADATA', refId); continue;
      }
      const current = images[resource.assetId];
      if (current && (current.size !== resource.bytes || current.contentType !== resource.contentType)) issue('SOURCE_IMAGE_METADATA_CONFLICT', refId);
      else images[resource.assetId] = { storageName: resource.assetId, digest: resource.contentDigest, size: resource.bytes, contentType: resource.contentType };
    }
  };
  const collectSnapshots = (snapshots, location, id) => {
    if (snapshots === undefined) return;
    if (!Array.isArray(snapshots)) { issue('INVALID_IMAGE_SOURCE_SNAPSHOTS', `${location}/${id}`); return; }
    for (const [index, source] of snapshots.entries()) collectImages(source, location, `${id}/${index}`);
  };
  for (const [id, source] of Object.entries(state.aiSources || {})) collectImages(source, 'sources', id);
  for (const [id, job] of Object.entries(state.aiJobs || {})) collectSnapshots(job?.sourceSnapshots, 'jobs', id);
  for (const [id, draft] of Object.entries(state.drafts || {})) {
    for (const revision of Array.isArray(draft?.revisions) ? draft.revisions : []) {
      collectSnapshots(revision?.generationMetadata?.sourceSnapshots, 'revisions', `${id}/${revision?.revisionId}`);
    }
  }
  report.sourceImages.uniqueAssets = Object.keys(images).length;
  report.sourceImages.declaredBytes = Object.values(images).reduce((sum, image) => sum + image.size, 0);
  const deliveryImages = {};
  for (const [taskIndex, task] of incrementalState.tasks.entries()) {
    if (!object(task)) { issue('INVALID_INCREMENTAL_TASK', taskIndex); continue; }
    if (!task.handbookSource) continue;
    const source = task.handbookSource;
    if (!object(source) || !Array.isArray(source.documents) || !digest(task.candidate?.digest)) { issue('INVALID_HANDBOOK_TASK_SNAPSHOT', task.id || taskIndex); continue; }
    if (source.content !== task.candidate.content || JSON.stringify(source.operations) !== JSON.stringify(task.candidate.operations)) issue('HANDBOOK_CANDIDATE_SOURCE_MISMATCH', task.id || taskIndex);
    for (const [documentIndex, document] of source.documents.entries()) {
      const id = `${task.id || taskIndex}/${documentIndex}`;
      if (!object(document) || !Array.isArray(document.resources)) { issue('MISSING_DELIVERY_RESOURCE_MANIFEST', id); continue; }
      for (const [resourceIndex, resource] of document.resources.entries()) {
        const refId = `${id}/${resourceIndex}`;
        if (resource?.delivery !== 'create') continue;
        report.deliveryImages.references++;
        const suffix = /\.([a-z]+)$/.exec(resource.path || '')?.[1];
        const type = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }[suffix];
        const segments = typeof resource.path === 'string' ? resource.path.split('/') : [];
        if (!digest(resource.contentDigest) || !Number.isSafeInteger(resource.size) || resource.size <= 0 ||
            segments.length < 2 || segments.some(part => !part || part === '.' || part === '..') ||
            segments.at(-1) !== `${resource.contentDigest}.${suffix}` || !type) {
          issue('INVALID_DELIVERY_IMAGE_METADATA', refId); continue;
        }
        const existing = deliveryImages[resource.contentDigest];
        if (existing && (existing.size !== resource.size || existing.contentType !== type)) issue('DELIVERY_IMAGE_METADATA_CONFLICT', refId);
        else deliveryImages[resource.contentDigest] = { storageName: resource.contentDigest, digest: resource.contentDigest, size: resource.size, contentType: type };
      }
    }
  }
  report.deliveryImages.uniqueAssets = Object.keys(deliveryImages).length;
  report.deliveryImages.declaredBytes = Object.values(deliveryImages).reduce((sum, item) => sum + item.size, 0);
  for (const target of scanTargets) {
    const parsed = target.kind === 'html' ? htmlImageLinks(target.text) : { links: markdownImageLinks(target.text), uncheckedSrcset: 0 };
    report.imageLinks.uncheckedSrcsetCandidates += parsed.uncheckedSrcset;
    for (const link of parsed.links) {
      const refId = `${target.location}/${target.id}/${hash(link)}`;
      report.imageLinks.byLocation[target.location]++;
      if (link.startsWith(attachmentPrefix)) {
        report.imageLinks.attachment++;
        const id = link.slice(attachmentPrefix.length).split(/[?#]/)[0];
        if (!id || id.includes('/') || !Object.hasOwn(attachments, id)) issue('MISSING_IMAGE_ATTACHMENT_METADATA', refId);
      } else if (sourceImagePath.test(link)) {
        report.imageLinks.sourceImage++;
        const id = sourceImagePath.exec(link)[1];
        if (!Object.hasOwn(images, id)) issue('MISSING_IMAGE_SOURCE_METADATA', refId);
      } else if (/^https?:\/\//i.test(link)) report.imageLinks.external++;
      else if (/^data:/i.test(link)) report.imageLinks.embedded++;
      else if (/^(?:javascript|vbscript):/i.test(link)) { report.imageLinks.unsafe++; issue('UNSAFE_IMAGE_LINK', refId); }
      else report.imageLinks.relative++;
    }
  }
  report.logicalPassed = report.issues.length === 0;
  if (attachmentRoot) await scanFiles(attachmentRoot, attachments, report.physical, issue, false, 'delivery-images');
  if (sourceImageRoot) await scanFiles(sourceImageRoot, images, report.sourceImages.physical,
    (code, id) => issue(code.replaceAll('ATTACHMENT', 'SOURCE_IMAGE'), id), true);
  if (attachmentRoot) await scanFiles(path.join(attachmentRoot, 'delivery-images'), deliveryImages, report.deliveryImages.physical,
    (code, id) => issue(code.replaceAll('ATTACHMENT', 'DELIVERY_IMAGE'), id), true);
  report.issues.sort((a, b) => a.code.localeCompare(b.code) || a.idHash.localeCompare(b.idHash));
  report.complete = report.physical.status === 'checked' && report.sourceImages.physical.status === 'checked' && report.deliveryImages.physical.status === 'checked';
  report.passed = report.complete && report.issues.length === 0;
  return report;
}

async function scanFiles(root, attachments, physical, issue, checkImageType = false, allowedDirectory = null) {
  const resolved = path.resolve(root);
  // Reject symlinks in every root component, not only the final directory.
  let current = path.parse(resolved).root;
  for (const part of resolved.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try { stat = await fs.promises.lstat(current); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      physical.status = 'root_unavailable';
      issue('ATTACHMENT_ROOT_UNAVAILABLE', 'attachment-root'); return;
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw Error('UNSAFE_ATTACHMENT_ROOT');
  }
  const names = new Set();
  for (const [id, item] of Object.entries(attachments)) {
    const name = item?.storageName;
    if (typeof name !== 'string' || !name || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) { issue('UNSAFE_ATTACHMENT_NAME', id); continue; }
    if (names.has(name)) issue('DUPLICATE_ATTACHMENT_STORAGE_NAME', id);
    names.add(name);
    let handle;
    try {
      handle = await fs.promises.open(path.join(resolved, name), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
      const before = await handle.stat();
      if (!before.isFile()) { issue('UNSAFE_ATTACHMENT_FILE', id); continue; }
      const hasher = createHash('sha256'); let bytes = 0; let signature = Buffer.alloc(0);
      for await (const chunk of handle.createReadStream({ autoClose: false })) {
        hasher.update(chunk); bytes += chunk.length;
        if (checkImageType && signature.length < 12) signature = Buffer.concat([signature, chunk.subarray(0, 12 - signature.length)]);
      }
      const after = await handle.stat();
      physical.files++; physical.bytes += bytes;
      if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) issue('ATTACHMENT_CHANGED_DURING_SCAN', id);
      if (bytes !== item.size) issue('ATTACHMENT_SIZE_MISMATCH', id);
      if (hasher.digest('hex') !== item.digest) issue('ATTACHMENT_DIGEST_MISMATCH', id);
      if (checkImageType && imageType(signature) !== item.contentType) issue('ATTACHMENT_TYPE_MISMATCH', id);
    } catch (error) {
      if (error.code === 'ENOENT') { physical.missing++; issue('MISSING_ATTACHMENT_FILE', id); }
      else issue('UNREADABLE_ATTACHMENT_FILE', id);
    } finally { if (handle) await handle.close(); }
  }
  for (const entry of await fs.promises.readdir(resolved, { withFileTypes: true })) {
    if (entry.name === allowedDirectory && entry.isDirectory()) continue;
    if (entry.isSymbolicLink() || entry.isDirectory() || !entry.isFile()) issue('UNSCANNED_ATTACHMENT_ENTRY', entry.name);
    else if (!names.has(entry.name)) { physical.unreferenced++; issue('UNREFERENCED_ATTACHMENT_FILE', entry.name); }
  }
  physical.status = 'checked';
}

if (require.main === module) (async () => {
  const base = process.env.YASDB_STORAGE_URL;
  const output = process.env.KC_CONTENT_INVENTORY_OUTPUT;
  if (!base || !output) throw Error('MISSING_OPTIONS');
  const report = await inventory(base, { attachmentRoot: process.env.KC_ATTACHMENT_ROOT, sourceImageRoot: process.env.KC_SOURCE_IMAGE_ROOT });
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log(`内容盘点：${report.counts.drafts}份草稿，${report.counts.revisions}份修订，${report.issues.length}项异常；附件核验${report.physical.status}，来源图片核验${report.sourceImages.physical.status}，交付图片核验${report.deliveryImages.physical.status}`);
  if (!report.passed) process.exitCode = 1;
})().catch(() => { console.error('内容盘点未完成；请核对只读接口协议、显式附件目录与输出文件是否已存在'); process.exitCode = 1; });
module.exports = { inventory };
