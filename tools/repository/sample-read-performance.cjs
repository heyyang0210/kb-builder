'use strict';
const { performance } = require('node:perf_hooks');
function percentile95(values) { return values.length ? [...values].sort((a,b) => a-b)[Math.ceil(values.length * .95) - 1] : null; }
async function sampleReads(url, { rounds, concurrency, timeoutMs, headers = {}, requireJsonSuccess = false }) {
  if (![rounds, concurrency, timeoutMs].every(n => Number.isSafeInteger(n) && n > 0)) throw Error('性能采样配置无效');
  let cursor = 0;
  const samples = Array(rounds);
  async function worker() {
    while (cursor < rounds) {
      const index = cursor++, started = performance.now();
      try {
        const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
        const body = await response.arrayBuffer();
        let businessValid = true;
        if (requireJsonSuccess) {
          try {
            const payload = JSON.parse(Buffer.from(body).toString('utf8'));
            businessValid = response.headers.get('content-type')?.toLowerCase().includes('application/json')
              && payload?.success === true && payload.data !== undefined;
          } catch { businessValid = false; }
        }
        samples[index] = { ms: performance.now() - started, status: response.status, bytes: body.byteLength,
          timing: response.headers.get('server-timing'), passed: response.ok && Boolean(businessValid),
          ...(requireJsonSuccess && !businessValid ? { errorCode: 'INVALID_BUSINESS_RESPONSE' } : {}) };
      } catch {
        samples[index] = { ms: performance.now() - started, status: null, bytes: 0, passed: false, errorCode: 'REQUEST_INCOMPLETE' };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, rounds) }, worker));
  const successful = samples.filter(s => s.passed);
  return { concurrency, requested: rounds, success: successful.length, failures: rounds - successful.length,
    p95Ms: percentile95(successful.map(s => s.ms)), maxBytes: successful.length ? Math.max(...successful.map(s => s.bytes)) : null, samples };
}
module.exports = { sampleReads, percentile95 };
