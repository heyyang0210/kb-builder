const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns').promises;
const net = require('node:net');
const zlib = require('node:zlib');
const cheerio = require('cheerio');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (_) {}
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

// 内部测试豁免：环境变量 BYPASS_SSRF_PRIVATE=1 时跳过私有地址检测
const bypassSSRF = process.env.BYPASS_SSRF_PRIVATE === '1';
// 豁免的私有 IP 列表（逗号分隔），用于特定内网站点
const exemptPrivateIPs = (process.env.EXEMPT_PRIVATE_IPS || '').split(',').filter(Boolean);

function isPublicAddress(address) {
  if (bypassSSRF || exemptPrivateIPs.includes(address)) return true;
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
  // 内部测试豁免：环境变量 EXEMPT_DOMAINS 中的域名跳过私有地址检查
  const exemptDomains = (process.env.EXEMPT_DOMAINS || '').split(',').filter(Boolean);
  const isExemptDomain = exemptDomains.some(d => hostname.endsWith(d));
  if (!addresses.length || (!trusted && !isExemptDomain && addresses.some(item => !isPublicAddress(item.address)))) {
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
      resolveTarget(url, config).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
    const response = await receive(url, address, signal, acceptedTypes.join(', '));
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
    return { data: Buffer.concat(chunks), contentType, type, url: url.href };
  }
}


// SPA 页面渲染：使用 Puppeteer 等待 JavaScript 执行后提取内容

// API 认证请求：通过 Bearer Token 或 Cookie 访问需要登录的 API
async function fetchWithAuth(url, config) {
  const authToken = process.env.SUPPORT_API_TOKEN || config.supportApiToken;
  const cookie = process.env.SUPPORT_COOKIE || config.supportCookie;

  const headers = { 'User-Agent': 'Mozilla/5.0' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  if (cookie) headers['Cookie'] = cookie;

  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      headers,
      timeout: config.timeoutMs
    }, resolve);
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(error('AI_SOURCE_UNAVAILABLE', 'API 请求超时', 504));
    });
  });
}

// 尝试从 API 获取内容（如果页面需要登录）

// SSR 预渲染服务：通过预渲染 API 获取 SPA 页面的完整 HTML
async function fetchFromSSRService(url, config) {
  const ssrServiceUrl = process.env.SSR_SERVICE_URL || config.ssrServiceUrl;
  if (!ssrServiceUrl) return null;

  // 调用预渲染服务，例如：http://localhost:3000/render?url=...
  const renderUrl = new URL(ssrServiceUrl);
  renderUrl.searchParams.set('url', url.href);
  renderUrl.searchParams.set('waitUntil', 'networkidle0');
  renderUrl.searchParams.set('timeout', config.timeoutMs.toString());

  return new Promise((resolve, reject) => {
    const request = (renderUrl.protocol === 'https:' ? https : http).get(renderUrl, {
      timeout: config.timeoutMs
    }, resolve);
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(error('AI_SOURCE_UNAVAILABLE', 'SSR 服务请求超时', 504));
    });
  });
}

// 从 SSR 服务获取内容
async function trySSRFetch(locator, config) {
  const ssrServiceUrl = process.env.SSR_SERVICE_URL || config.ssrServiceUrl;
  if (!ssrServiceUrl) return null;

  const url = new URL(locator);
  try {
    const response = await fetchFromSSRService(url, config);
    if (response.statusCode === 200) {
      const chunks = [];
      for await (const chunk of response) chunks.push(chunk);
      const data = Buffer.concat(chunks);
      const html = data.toString('utf-8');

      // 检查是否返回了有效内容（不是空 app 容器）
      if (!html.includes('<div id="app"></div>') && html.length > 500) {
        return {
          data,
          contentType: 'text/html',
          type: 'text/html',
          url: locator
        };
      }
    }
  } catch (_) {}
  return null;
}

async function tryApiFetch(locator, config) {
  const apiToken = process.env.SUPPORT_API_TOKEN || config.supportApiToken;
  const cookie = process.env.SUPPORT_COOKIE || config.supportCookie;

  if (!apiToken && !cookie) return null;

  // 尝试 API 路径
  const apiPath = `/api/knowledge/${locator.split('/').pop()}`;
  const apiUrl = new URL(apiPath, locator);

  try {
    const response = await fetchWithAuth(apiUrl, config);
    if (response.statusCode === 200) {
      const chunks = [];
      for await (const chunk of response) chunks.push(chunk);
      const data = Buffer.concat(chunks);
      const json = JSON.parse(data.toString('utf-8'));
      if (json.code === 0 && json.data) {
        // 假设 API 返回 { data: { content: "...", title: "..." } }
        return {
          content: json.data.content || json.data.body || JSON.stringify(json.data),
          title: json.data.title || '',
          locator: apiUrl.href
        };
      }
    }
  } catch (_) {}
  return null;
}

async function renderSPA(url, config) {
  if (!puppeteer) throw error('AI_SOURCE_SPA_UNSUPPORTED', 'SPA 页面需要 Puppeteer 支持，请安装 puppeteer', 415);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(url.href, { waitUntil: 'networkidle0', timeout: config.timeoutMs });
    // 等待主要内容加载
    await page.waitForSelector('main, article, [role="main"], #app', { timeout: 10000 }).catch(() => {});
    const html = await page.content();
    return Buffer.from(html, 'utf-8');
  } finally {
    await browser.close();
  }
}

async function readWebReference(locator, config) {
    // 优先尝试 API 获取（适用于需要登录的页面）
    const apiResult = await tryApiFetch(locator, config);
    if (apiResult) return apiResult;

    // 尝试 SSR 预渲染（如果配置了 SSR 服务）
    let ssrData = null;
    const ssrResult = await trySSRFetch(locator, config);
    if (ssrResult) ssrData = ssrResult;

    const { data, contentType, type, url: finalURL } = ssrData || await readRemoteResource(locator, config,
      ['text/html', 'application/xhtml+xml', 'text/markdown', 'text/x-markdown', 'text/plain']);
    const url = new URL(finalURL);
    const charset = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1] || 'utf-8';
    let raw;
    try { raw = new TextDecoder(charset).decode(data); }
    catch (_) { throw error('AI_SOURCE_FORMAT_UNSUPPORTED', '网页字符编码无法识别', 415); }
    if (!['text/html', 'application/xhtml+xml'].includes(type)) return { content: raw, locator: url.href, originalUrl: locator };

    // 检测是否为 SPA 页面（body 为空或只有空的 app 容器，无实际内容）
    const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1].trim() : '';
    const isSPA = bodyContent === '' || /^<div id="app"[^>]*>\s*<\/div>\s*(<!--[\s\S]*?-->)?\s*$/.test(bodyContent);

    if (isSPA && puppeteer) {
      // 使用 Puppeteer 渲染 SPA 页面
      data = await renderSPA(url, config);
      raw = new TextDecoder(charset).decode(data);
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
    const content = new HtmlAdapter().htmlToMarkdown($, { imageResolver: source => {
      try {
        const image = new URL(source, imageBase);
        return ['http:', 'https:'].includes(image.protocol) && !image.username && !image.password ? image.href : null;
      } catch (_) { return null; }
    } });
    if (!content.trim()) throw error('AI_SOURCE_EMPTY', '网页没有可提取正文，可能需要登录或动态加载', 422);
    return { title, content, locator: url.href, originalUrl: locator };
}
module.exports = { readWebReference, readRemoteResource, resolveTarget, isPublicAddress };
