const http = require('http');
const logger = require('./logger');
const { createId, validId } = require('./log-context');

function createProxy({ targetHost, targetPort, pathTransform, errorPayload, requestHeaders, normalizeErrorResponse, transformResponse, validateResponse }) {
  return function proxy(req, res, context = {}) {
    const targetPath = pathTransform ? pathTransform(req) : (req.url || '/');
    const requestHeader = req.headers['x-request-id'];
    const correlationHeader = req.headers['x-correlation-id'];
    const requestId = validId(requestHeader) ? requestHeader : createId('req');
    const correlationId = validId(correlationHeader) ? correlationHeader : requestId;
    const startedAt = Date.now();
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
          logger.info('proxy.completed', { event: status >= 400 ? 'proxy.failed' : 'proxy.completed', requestId, correlationId, method: req.method, route: targetPath.split('?')[0], targetService: `${targetHost}:${targetPort}`, status, durationMs: Date.now() - startedAt });
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
              logger.error('proxy.contract_invalid', { event: 'proxy.failed', requestId, correlationId, errorCode: 'KNOWLEDGE_CONTRACT_INVALID', errorType: error.name, stack: error.stack, targetService: `${targetHost}:${targetPort}`, durationMs: Date.now() - startedAt });
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
          delete headers['transfer-encoding'];
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
      logger.error('proxy.connection_failed', { event: 'proxy.failed', requestId, correlationId, errorCode: error.code || 'PROXY_CONNECTION_FAILED', errorType: error.name, stack: error.stack, targetService: `${targetHost}:${targetPort}`, durationMs: Date.now() - startedAt });
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
