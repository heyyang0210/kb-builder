const http = require('node:http');
const { parentPort, workerData } = require('node:worker_threads');
const records = new Map(Object.entries(workerData.records || {}));
const reads = new Map();
let failure = null;
let emptyExport = false;
const writes = [];
const server = http.createServer(async (req, res) => {
  let text = '';
  for await (const chunk of req) text += chunk;
  res.setHeader('Content-Type', 'application/json');
  const reply = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
  const id = decodeURIComponent(req.url.split('/').pop());
  if (failure === req.method || failure === req.url) return reply(503, { success: false, error: { code: 'STORAGE_UNAVAILABLE', message: '隔离存储故障' } });
  if (req.url === '/v1/export' && emptyExport) return reply(200, {});
  if (req.url === '/v1/export') return reply(200, { records: [...records].map(([key, payload]) => ({ namespace: key === 'unrelated' ? 'other' : 'workflows', payload })) });
  if (req.method === 'GET') {
    reads.set(id, (reads.get(id) || 0) + 1);
    if (id === workerData.failFirstRead && reads.get(id) === 1) return reply(503, { success: false, error: { code: 'STORAGE_UNAVAILABLE' } });
    if (!records.has(id)) return reply(404, { success: false, error: { code: 'RECORD_NOT_FOUND' } });
    return reply(200, { payload: records.get(id), revision: writes.filter(w => w.id === id).length + 1 });
  }
  if (req.method === 'PUT') {
    const payload = JSON.parse(text);
    writes.push({ id, payload, revision: req.headers['if-match'] });
    records.set(id, payload);
    return reply(200, { revision: writes.filter(w => w.id === id).length + 1 });
  }
  reply(405, { success: false });
});
server.listen(0, '127.0.0.1', () => parentPort.postMessage({ port: server.address().port }));
parentPort.on('message', message => {
  if (message.type === 'failure') failure = message.value;
  if (message.type === 'empty-export') emptyExport = message.value;
  parentPort.postMessage({ type: message.type, records: Object.fromEntries(records), writes });
});
