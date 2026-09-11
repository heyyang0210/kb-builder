const http = require('http');
const crypto = require('crypto');

function createProxy({ targetHost, targetPort, pathTransform, errorPayload, requestHeaders, normalizeErrorResponse, transformResponse, validateResponse }) {
  return function proxy(req, res, context = {}) {
    const targetPath = pathTransform ? pathTransform(req) : (req.url || '/');
    const requestId = String(req.headers['x-request-id'] || crypto.randomUUID());
    const correlationId = String(req.headers['x-correlation-id'] || requestId);
    const headers = { ...req.headers, host: `${targetHost}:${targetPort}`, 'x-request-id': requestId, 'x-correlation-id': correlationId };
    if (requestHeaders) Object.assign(headers, requestHeaders(req, context));
    const proxyRequest = http.request({
      hostname: targetHost,
      port: targetPort,
      path: targetPath,
      method: req.method,
      headers,
    }, proxyResponse => {
      const contentType = String(proxyResponse.headers['content-type'] || '').toLowerCase();
      const shouldBuffer = (normalizeErrorResponse && (proxyResponse.statusCode || 500) >= 400)
        || (transformResponse && (proxyResponse.statusCode || 500) < 400 && contentType.includes('application/json'));
      if (shouldBuffer) {
        const chunks = [];
        proxyResponse.on('data', chunk => chunks.push(chunk));
        proxyResponse.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          const status = proxyResponse.statusCode || 500;
          const payload = status >= 400
            ? normalizeErrorResponse(raw, status, requestId, correlationId, context)
            : transformResponse(raw, status, requestId, correlationId, context);
          if (payload === undefined) {
            res.writeHead(status, proxyResponse.headers);
            res.end(raw);
            return;
          }
          if (validateResponse) {
            try {
              validateResponse(payload, status, context);
            } catch (error) {
              const contractPayload = {
                success: false,
                error: {
                  code: 'KNOWLEDGE_CONTRACT_INVALID',
                  message: '下游响应不符合知识中心接口契约',
                  retryable: false,
                  requestId,
                  correlationId,
                  details: { reason: error.message, endpoint: context?.endpoint?.id || null },
                },
              };
              res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'x-request-id': requestId, 'x-correlation-id': correlationId });
              res.end(JSON.stringify(contractPayload));
              return;
            }
          }
          const headers = { ...proxyResponse.headers, 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(JSON.stringify(payload)), 'x-request-id': requestId, 'x-correlation-id': correlationId };
          res.writeHead(status, headers);
          res.end(JSON.stringify(payload));
        });
        return;
      }
      res.writeHead(proxyResponse.statusCode || 502, {
        ...proxyResponse.headers,
        'x-request-id': requestId,
        'x-correlation-id': correlationId,
      });
      proxyResponse.pipe(res);
    });
    proxyRequest.on('error', error => {
      const body = typeof errorPayload === 'function' ? errorPayload(error, requestId, correlationId) : errorPayload;
      if (body?.error && typeof body.error === 'object') {
        body.error.requestId = body.error.requestId || requestId;
        body.error.correlationId = body.error.correlationId || correlationId;
      }
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'x-request-id': requestId, 'x-correlation-id': correlationId });
      res.end(JSON.stringify(body));
    });
    req.pipe(proxyRequest);
  };
}

module.exports = { createProxy };
