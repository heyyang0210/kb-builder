const http = require('http');

function createProxy({ targetHost, targetPort, pathTransform, errorPayload, requestHeaders }) {
  return function proxy(req, res) {
    const targetPath = pathTransform ? pathTransform(req) : (req.url || '/');
    const headers = { ...req.headers, host: `${targetHost}:${targetPort}` };
    if (requestHeaders) Object.assign(headers, requestHeaders(req));
    const proxyRequest = http.request({
      hostname: targetHost,
      port: targetPort,
      path: targetPath,
      method: req.method,
      headers,
    }, proxyResponse => {
      res.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
      proxyResponse.pipe(res);
    });
    proxyRequest.on('error', error => {
      const body = typeof errorPayload === 'function' ? errorPayload(error) : errorPayload;
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    });
    req.pipe(proxyRequest);
  };
}

module.exports = { createProxy };
