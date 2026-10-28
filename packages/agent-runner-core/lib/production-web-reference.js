const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns').promises;
const net = require('node:net');
const zlib = require('node:zlib');
const cheerio = require('cheerio');
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
  const trusted = (config.urlOrigins || []).includes(url.origin);
  if (!trusted && !config.allowPublicWeb) throw error('AI_SOURCE_URL_DENIED', '该网址尚未启用引用读取', 403);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(hostname) ? [{ address: hostname, family: net.isIP(hostname) }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || (!trusted && addresses.some(item => !isPublicAddress(item.address)))) {
    throw error('AI_SOURCE_URL_DENIED', '该网址指向非公开网络地址；内部文档请使用管理员配置的来源', 403);
  }
  return addresses[0];
}

function receive(url, address, signal) {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      signal, agent: false,
      // Pin the checked DNS result, while retaining the URL host for TLS and Host.
      lookup: (_host, options, callback) => options.all
        ? callback(null, [address]) : callback(null, address.address, address.family),
      headers: { Accept: 'text/html, text/markdown, text/plain', 'Accept-Encoding': 'gzip, deflate, br' },
    }, resolve);
    request.on('error', reject);
  });
}

async function readWebReference(locator, config) {
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
      resolveTarget(url, config).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
    const response = await receive(url, address, signal);
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
    if (!['text/html', 'application/xhtml+xml', 'text/markdown', 'text/x-markdown', 'text/plain'].includes(type)) {
      response.destroy();
      throw error('AI_SOURCE_FORMAT_UNSUPPORTED', '支持 HTML 网页、Markdown 和纯文本资料', 415);
    }
    if (Number(response.headers['content-length']) > config.maxBytes) {
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
        if (bytes > config.maxBytes) throw error('AI_SOURCE_TOO_LARGE', '引用资料超过允许的大小', 413);
        chunks.push(chunk);
      }
    } finally { response.destroy(); decoder?.destroy(); }
    const charset = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1] || 'utf-8';
    let raw;
    try { raw = new TextDecoder(charset).decode(Buffer.concat(chunks)); }
    catch (_) { throw error('AI_SOURCE_FORMAT_UNSUPPORTED', '网页字符编码无法识别', 415); }
    if (!['text/html', 'application/xhtml+xml'].includes(type)) return { content: raw, locator: url.href, originalUrl: locator };
    const $ = cheerio.load(raw);
    const title = $('title').first().text().trim() || $('h1').first().text().trim();
    $('script, style, noscript, template, nav, footer, header, aside, form, iframe, svg, [hidden], [aria-hidden="true"]').remove();
    const main = $('main, article, [role="main"]').first();
    if (main.length) $('body').empty().append(main);
    const content = new HtmlAdapter().htmlToMarkdown($, { imageResolver: source => {
      try {
        const image = new URL(source, url);
        return ['http:', 'https:'].includes(image.protocol) && !image.username && !image.password ? image.href : null;
      } catch (_) { return null; }
    } });
    if (!content.trim()) throw error('AI_SOURCE_EMPTY', '网页没有可提取正文，可能需要登录或动态加载', 422);
    return { title, content, locator: url.href, originalUrl: locator };
  }
}
module.exports = { readWebReference, resolveTarget, isPublicAddress };
