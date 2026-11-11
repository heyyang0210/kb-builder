const http = require('node:http');
const { parentPort, workerData } = require('node:worker_threads');
let rawResponses = false;

const server = http.createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  res.setHeader('Content-Type', 'application/json');
  if (req.url !== '/no-timing') res.setHeader('Server-Timing', 'storage-total;dur=2.5');
  if (req.url === '/empty') { res.end(); return; }
  if (req.url === '/generic-error') {
    res.statusCode = 422;
    res.end(JSON.stringify({ success: false }));
    return;
  }
  if (req.url.startsWith('/mapped-error?')) {
    const code = new URL(req.url, 'http://127.0.0.1').searchParams.get('code');
    res.end(JSON.stringify({ success: false, error: { code, message: `后端拒绝 ${code}` } }));
    return;
  }
  if (req.url === '/error') {
    res.statusCode = 409;
    res.end(JSON.stringify({ success: false, error: { code: 'OUTLINE_DELETED', message: '大纲已删除', details: { id: 'outline-1' } } }));
    return;
  }
  if (req.url === '/malformed') {
    res.end('{invalid');
    return;
  }
  const observed = { method: req.method, url: req.url, body: body ? JSON.parse(body) : null, headers: req.headers };
  const responseKey = `${req.method} ${req.url}`;
  if (workerData?.responses && Object.hasOwn(workerData.responses, responseKey)) {
    res.end(JSON.stringify({ success: true, data: workerData.responses[responseKey] }));
    return;
  }
  if (req.url === '/raw') res.end(JSON.stringify({ success: true, observed }));
  else res.end(JSON.stringify(rawResponses ? { success: true, observed } : { success: true, data: observed }));
});

server.listen(0, '127.0.0.1', () => parentPort.postMessage(server.address().port));
parentPort.on('message', message => {
  if (message === 'close') server.close(() => parentPort.close());
  if (message?.type === 'raw-responses') {
    rawResponses = message.enabled;
    parentPort.postMessage({ type: 'raw-responses', enabled: rawResponses });
  }
});
