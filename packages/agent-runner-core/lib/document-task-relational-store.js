const { DomainStore } = require('./domain-store');

function createDocumentTaskRelationalStore(options = {}) {
  const storage = options.storage || new DomainStore();
  const request = async (method, path, body, headers) =>
    (await storage.requestAsync(method, `/v1/document-tasks${path}`, body, headers)).data;
  return {
    async active() { return Boolean((await request('GET', '/status')).active); },
    async config() { return request('GET', '/config'); },
    async putConfig(config, expectedStorageRevision, identity, digest) {
      return request('PUT', '/config', { config, expectedStorageRevision,
        idempotencyKey: identity, requestSha256: digest }, { 'Idempotency-Key': identity });
    },
    async find(number) {
      try { return await request('GET', `/${encodeURIComponent(number)}`); }
      catch (error) { if (error.code === 'DOCUMENT_TASK_NOT_FOUND') return null; throw error; }
    },
    async list(filters = {}) {
      const query = new URLSearchParams(Object.entries(filters)
        .filter(([, value]) => value !== undefined && value !== null && value !== ''));
      return request('GET', `?${query}`);
    },
    async mine(principalId, page = 1, pageSize = 100, visibleHandbooks) {
      const query = new URLSearchParams({ principalId, page, pageSize });
      if (visibleHandbooks) query.set('visibleHandbooks', visibleHandbooks.join(','));
      return request('GET', `/mine?${query}`);
    },
    async byReview(reviewId) { return request('GET', `/by-review/${encodeURIComponent(reviewId)}`); },
    async source(number) {
      return (await storage.requestAsync('GET',
        `/v1/pingcode-task-sync/tasks/${encodeURIComponent(number)}/source`)).data;
    },
    async changes(number, page = 1, pageSize = 20) {
      return (await storage.requestAsync('GET',
        `/v1/pingcode-task-sync/tasks/${encodeURIComponent(number)}/changes?page=${page}&pageSize=${pageSize}`)).data;
    },
    async replay(key) {
      try { return await request('GET', `/writes/${encodeURIComponent(key)}`); }
      catch (error) { if (error.code === 'DOCUMENT_TASK_WRITE_NOT_FOUND') return null; throw error; }
    },
    async put(number, task, expectedRowVersion, identity, digest, response) {
      return request('PUT', `/${encodeURIComponent(number)}`,
        { task, expectedRowVersion, idempotencyKey: identity, requestSha256: digest, response },
        { 'Idempotency-Key': identity });
    },
  };
}

module.exports = { createDocumentTaskRelationalStore };
