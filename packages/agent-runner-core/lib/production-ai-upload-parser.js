const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');

// Parsing is isolated so malformed archives/PDFs cannot hold the HTTP event loop.
async function parseUpload(buffer, extension, policy, imagePolicy) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { buffer, extension, policy, imagePolicy }, resourceLimits: { maxOldGenerationSizeMb: policy.memoryMb } });
    let settled = false;
    const finish = (error, result) => {
      if (settled) return; settled = true; clearTimeout(timer); void worker.terminate();
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => finish(new Error('文档解析超时，请缩小文件后重试')), policy.timeoutMs);
    worker.once('message', result => result.error ? finish(new Error(result.error)) : finish(null, result));
    worker.once('error', error => finish(error));
    worker.once('exit', code => { if (!settled) finish(new Error(`文档解析未完成（${code}）`)); });
  });
}

async function parse() {
  const { extension, policy, imagePolicy } = workerData;
  const buffer = Buffer.from(workerData.buffer);
  if (['md', 'markdown', 'txt', 'sql'].includes(extension)) {
    const content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    if (content.includes('\0')) throw new Error('文本包含二进制内容');
    return { content };
  }
  if (['html', 'htm'].includes(extension)) {
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    if (raw.includes('\0') || !/<[a-z][\s\S]*?>/i.test(raw)) throw new Error('HTML 文件格式无效');
    const $ = require('cheerio').load(raw);
    $('script, style, noscript, template, nav, footer, header, aside, form, iframe, svg, [hidden], [aria-hidden="true"]').remove();
    $('a[href]').each((_, element) => {
      const link = $(element);
      const href = link.attr('href') || '';
      if (!/^https?:\/\//i.test(href) && !href.startsWith('#')) link.replaceWith(link.text());
    });
    const main = $('main, article, [role="main"]').first();
    if (main.length) $('body').empty().append(main);
    const content = new (require('./preprocessing/cleaners/html-adapter').HtmlAdapter)()
      .htmlToMarkdown($, { imageResolver: () => null });
    return { content };
  }
  if (extension === 'pdf') {
    if (buffer.subarray(0, 5).toString() !== '%PDF-') throw new Error('PDF 文件格式无效');
    const result = await require('pdf-parse/lib/pdf-parse')(buffer, { max: policy.maxPdfPages });
    if (result.numpages > policy.maxPdfPages) throw new Error('PDF 页数超出限制');
    return { content: result.text };
  }
  if (extension !== 'docx') throw new Error('不支持的文档格式');
  const zip = new (require('adm-zip'))(buffer);
  const entries = zip.getEntries();
  const size = entries.reduce((sum, entry) => sum + entry.header.size, 0);
  if (size > policy.maxExpandedBytes || !zip.getEntry('word/document.xml')) throw new Error('Word 文件无效或解压后过大');
  const mammoth = require('mammoth');
  const imageResources = [];
  let imageBytes = 0;
  const result = await mammoth.convertToHtml({ buffer }, { externalFileAccess: false, convertImage: mammoth.images.imgElement(async image => {
    if (imageResources.length >= imagePolicy.maxCount) return { src: 'source-image:omitted' };
    const data = await image.read(); imageBytes += data.length;
    const reference = `source-image:local-${imageResources.length}`;
    const available = data.length <= imagePolicy.maxBytes && imageBytes <= imagePolicy.maxTotalBytes;
    imageResources.push({ reference, status: available ? 'ready' : 'failed', ...(available ? { dataBase64: data.toString('base64') } : {}) });
    return { src: reference };
  }) });
  const { HtmlAdapter } = require('./preprocessing/cleaners/html-adapter');
  const content = new HtmlAdapter().htmlToMarkdown(require('cheerio').load(result.value), { imageResolver: source => source.startsWith('source-image:') ? source : null });
  return { content, imageResources, authenticatedImages: true };
}
if (!isMainThread) parse().then(result => parentPort.postMessage(result)).catch(() => parentPort.postMessage({ error: '文件格式无效、内容损坏或超出解析限制' }));
module.exports = { parseUpload };
