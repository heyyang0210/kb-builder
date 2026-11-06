const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns').promises;
const net = require('node:net');
const zlib = require('node:zlib');
const cheerio = require('cheerio');
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {}
const { HtmlAdapter } = require('./preprocessing/cleaners/html-adapter');

const error = (code, message, status = 400) => Object.assign(new Error(message), { code, status });
const denied = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 3],
]) denied.addSubnet(address, prefix, 'ipv4');
const publicV6 = new net.BlockList();
publicV6.addSubnet('2000::', 3, 'ipv6');
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]]) denied.addSubnet(address, prefix, 'ipv6');

function isPublicAddress(address) {
  const family = net.isIP(address);
  return family === 4 ? !denied.check(address, 'ipv4')
    : family === 6 && publicV6.check(address, 'ipv6') && !denied.check(address, 'ipv6');
}

async function resolveTarget(url, config, lookup = dns.lookup) {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw error('AI_SOURCE_URL_DENIED', '仅支持不含账号密码的 HTTP 或 HTTPS 网页地址', 403);
  }
  if (!(config.urlOrigins || []).includes(url.origin) && !config.allowPublicWeb) throw error('AI_SOURCE_URL_DENIED', '该网址尚未启用引用读取', 403);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(hostname) ? [{ address: hostname, family: net.isIP(hostname) }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) {
    throw error('AI_SOURCE_URL_DENIED', '该网址指向非公开网络地址；内部文档请使用管理员配置的来源', 403);
  }
  return addresses[0];
}

function receive(url, address, signal, accept) {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      signal, agent: false,
      // Pin the checked DNS result, while retaining the URL host for TLS and Host.
      lookup: (_host, options, callback) => options.all
        ? callback(null, [address]) : callback(null, address.address, address.family),
      headers: { Accept: accept, 'Accept-Encoding': 'gzip, deflate, br' },
    }, resolve);
    request.on('error', reject);
  });
}

async function readRemoteResource(locator, config, acceptedTypes) {
  const signal = AbortSignal.timeout(config.timeoutMs);
  let url;
  try { url = new URL(locator); } catch (_) { throw error('AI_SOURCE_URL_INVALID', '请输入有效的网页地址'); }
  const visited = new Set();
  for (let hop = 0; ; hop++) {
    url.hash = '';
    if (visited.has(url.href)) throw error('AI_SOURCE_REDIRECT_LIMIT', '网页重定向形成循环', 422);
    visited.add(url.href);
    // Bound DNS resolution as well as response reading by the same deadline.
    const address = await new Promise((resolve, reject) => {
      const abort = () => reject(error('AI_SOURCE_UNAVAILABLE', '网页读取超时，请稍后重试', 504));
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) { abort(); return; }
      resolveTarget(url, config, config.lookup || dns.lookup).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
    const response = await (config.receive || receive)(url, address, signal, acceptedTypes.join(', '));
    const status = response.statusCode;
    if ([301, 302, 303, 307, 308].includes(status)) {
      response.destroy();
      if (!response.headers.location || hop >= (config.maxRedirects ?? 5)) throw error('AI_SOURCE_REDIRECT_LIMIT', '网页重定向次数超过限制', 422);
      url = new URL(response.headers.location, url);
      continue;
    }
    if (status < 200 || status >= 300) {
      response.destroy();
      throw error('AI_SOURCE_UNAVAILABLE', '无法读取网页，请检查地址及访问权限', 502);
    }
    const contentType = response.headers['content-type'] || '';
    const type = contentType.split(';')[0].trim().toLowerCase();
    if (!acceptedTypes.includes(type)) {
      response.destroy();
      throw error('AI_SOURCE_FORMAT_UNSUPPORTED', '支持 HTML 网页、Markdown 和纯文本资料', 415);
    }
    const maxResponseBytes = config.webMaxResponseBytes ?? Math.max(config.maxBytes * 8, 2 * 1024 * 1024);
    if (Number(response.headers['content-length']) > maxResponseBytes) {
      response.destroy(); throw error('AI_SOURCE_TOO_LARGE', '引用资料超过允许的大小', 413);
    }
    const encoding = response.headers['content-encoding'];
    const decoder = encoding === 'gzip' ? zlib.createGunzip() : encoding === 'deflate' ? zlib.createInflate() : encoding === 'br' ? zlib.createBrotliDecompress() : null;
    if (encoding && encoding !== 'identity' && !decoder) {
      response.destroy(); throw error('AI_SOURCE_FORMAT_UNSUPPORTED', '网页使用了不支持的内容编码', 415);
    }
    const stream = decoder ? response.pipe(decoder) : response;
    if (decoder) response.on('error', cause => decoder.destroy(cause));
    let bytes = 0; const chunks = [];
    try {
      for await (const chunk of stream) {
        bytes += chunk.length;
        if (bytes > maxResponseBytes) throw error('AI_SOURCE_TOO_LARGE', '网页原始内容超过允许的大小', 413);
        chunks.push(chunk);
      }
    } finally { response.destroy(); decoder?.destroy(); }
    return { data: Buffer.concat(chunks), contentType, type, url: url.href };
  }
}


// SPA 页面渲染：使用 Puppeteer 等待 JavaScript 执行后提取内容

async function renderSPA(url, config) {
  if (!chromium) throw error('AI_SOURCE_SPA_UNSUPPORTED', '动态网页渲染组件不可用', 415);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
    const deadline = Date.now() + config.timeoutMs;
    let requestCount = 0;
    let totalBytes = 0;
    page.setDefaultNavigationTimeout(config.timeoutMs);
    page.setDefaultTimeout(Math.min(config.timeoutMs, 5000));
    await page.route('**/*', async route => {
      try {
        if (Date.now() >= deadline || ++requestCount > 24) return route.abort();
        const resource = await readRemoteResource(route.request().url(), { ...config, timeoutMs: Math.max(1, deadline - Date.now()) },
          ['text/html', 'application/xhtml+xml', 'text/javascript', 'application/javascript', 'application/json', 'text/css', 'text/plain', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']);
        totalBytes += resource.data.length;
        if (totalBytes > (config.webMaxResponseBytes ?? 2 * 1024 * 1024) * 2) return route.abort();
        await route.fulfill({ status: 200, contentType: resource.contentType, body: resource.data });
      } catch (_) { await route.abort().catch(() => {}); }
    });
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs });
    // 等待主要内容加载
    await page.waitForFunction(() => !!document.querySelector('main, article, [role="main"]') || (document.body?.innerText?.trim().length || 0) > 80,
      null, { timeout: Math.min(3000, config.timeoutMs) }).catch(() => {});
    const html = await page.content();
    if (Buffer.byteLength(html) > (config.webMaxResponseBytes ?? 2 * 1024 * 1024)) throw error('AI_SOURCE_TOO_LARGE', '渲染后网页超过允许的大小', 413);
    return Buffer.from(html, 'utf-8');
  } finally {
    await browser.close();
  }
}

async function readWebReference(locator, config) {
    const deadline = Date.now() + config.timeoutMs;
    const { data: responseData, contentType, type, url: finalURL } = await readRemoteResource(locator, config,
      ['text/html', 'application/xhtml+xml', 'text/markdown', 'text/x-markdown', 'text/plain']);
    const url = new URL(finalURL);
    const charset = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1] || 'utf-8';
    let raw;
    try { raw = new TextDecoder(charset).decode(responseData); }
    catch (_) { throw error('AI_SOURCE_FORMAT_UNSUPPORTED', '网页字符编码无法识别', 415); }
    assertPageIsNotRestricted(url, raw);
    if (!['text/html', 'application/xhtml+xml'].includes(type)) {
      if (Buffer.byteLength(raw) > (config.maxBytes ?? 262144)) throw error('AI_SOURCE_TOO_LARGE', '网页正文超过允许的大小', 413);
      return { content: raw, locator: url.href, originalUrl: new URL(locator).href };
    }
    // 检测常见 SPA 空壳，后续由受限浏览器尝试渲染。
    const shell = cheerio.load(raw);
    const hasScripts = shell('script').length > 0;
    shell('script, style, noscript, template').remove();
    const appRoot = shell('body').find('#app, #root, #__next').first();
    const appText = appRoot.text().trim();
    const outsideText = shell('body').clone().find('#app, #root, #__next').remove().end().text().trim();
    const isSPA = !!appRoot.length && hasScripts && !outsideText && appText.length <= 80
      && !appRoot.find('main, article, h1, h2, h3, p, li, pre, table').length;

    if (isSPA && chromium) {
      // 使用 Puppeteer 渲染 SPA 页面
      if (Date.now() >= deadline) throw error('AI_SOURCE_UNAVAILABLE', '网页读取超时，请稍后重试', 504);
      const data = await renderSPA(url, { ...config, timeoutMs: deadline - Date.now() });
      raw = new TextDecoder(charset).decode(data);
      assertPageIsNotRestricted(url, raw);
    }

    const $ = cheerio.load(raw);
    let imageBase = url;
    try { imageBase = new URL($('base[href]').first().attr('href') || '', url); } catch (_) {}
    $('img').each((_, el) => {
      const image = $(el);
      const lazy = image.attr('data-src') || image.attr('data-original') || image.attr('data-lazy-src');
      const set = (image.attr('data-srcset') || image.attr('srcset') || '').split(',')[0].trim().split(/\s+/)[0];
      image.attr('src', lazy || image.attr('src') || set || '');
    });
    const title = $('title').first().text().trim() || $('h1').first().text().trim();
    $('script, style, noscript, template, nav, footer, header, aside, form, iframe, svg, [hidden], [aria-hidden="true"]').remove();
    const main = $('main, article, [role="main"]').first();
    if (main.length) $('body').empty().append(main);
    else {
      const candidates = $('body').find('div, section').toArray().map(el => $(el))
        .filter(node => node.find('p, h1, h2, h3, pre, table, li').length >= 3)
        .sort((a, b) => b.text().trim().length - a.text().trim().length);
      if (candidates.length) $('body').empty().append(candidates[0]);
    }
    const content = new HtmlAdapter().htmlToMarkdown($, { imageResolver: source => {
      try {
        const image = new URL(source, imageBase);
        return ['http:', 'https:'].includes(image.protocol) && !image.username && !image.password ? image.href : null;
      } catch (_) { return null; }
    } });
    if (!content.trim()) throw error('AI_SOURCE_EMPTY', '网页没有可提取正文，可能需要登录或动态加载', 422);
    const maxContentBytes = config.maxBytes ?? 262144;
    if (Buffer.byteLength(content) > maxContentBytes) throw error('AI_SOURCE_TOO_LARGE', '提取后的网页正文超过允许的大小', 413);
    return { title, content, locator: url.href, originalUrl: new URL(locator).href };
}

function assertPageIsNotRestricted(url, raw) {
  const $ = cheerio.load(raw);
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 12000);
  const title = $('title').text().trim();
  const path = url.pathname.toLowerCase();
  const markers = [
    /环境异常.{0,40}(验证|访问)/i, /完成验证后.{0,30}(继续|访问)/i,
    /验证码|人机验证|安全验证|访问受限|请求过于频繁/i,
    /sign\s*in\s+to\s+continue|log\s*in\s+to\s+continue|please\s+sign\s+in/i,
    /verify\s+you\s+are\s+human|checking\s+your\s+browser|unusual\s+traffic|are\s+you\s+a\s+robot/i,
    /访问被拒绝|无权访问|登录后查看|请先登录/i,
  ];
  const challengePath = /captcha|wappoc_appmsgcaptcha|challenge|access[-_/]?denied|(?:^|\/)login(?:\/|$)/.test(path);
  const blockedTitle = /验证|captcha|access denied|sign in|登录/i.test(title);
  if (challengePath || (blockedTitle && text.length < 3000) || markers.some(pattern => pattern.test(text))) {
    throw error('AI_SOURCE_ACCESS_RESTRICTED', '网页要求登录、访问验证或限制了自动读取；请重新读取，或上传已取得的本地文档。', 422);
  }
}
module.exports = { readWebReference, readRemoteResource, resolveTarget, isPublicAddress };
