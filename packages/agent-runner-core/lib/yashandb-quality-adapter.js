const { DatabaseRecordStore } = require('./database-record-store');

function isolatedQualityDatabaseConfigured(env = process.env) {
  const qualityUrl = String(env.YASDB_QUALITY_JDBC_URL || '').trim();
  const storageUrl = String(env.YASDB_JDBC_URL || '').trim();
  return Boolean(qualityUrl && (!storageUrl || qualityUrl !== storageUrl)
    && String(env.YASDB_QUALITY_USERNAME || '').trim()
    && String(env.YASDB_QUALITY_PASSWORD || '').trim());
}

/** The storage HTTP endpoint opens a separate, read-only quality JDBC connection. */
function createYashanDBQualityAdapter(options = {}) {
  const store = options.store || new DatabaseRecordStore({ baseUrl: options.baseUrl, timeoutMs: options.timeoutMs });
  let qualityDatabaseVersion = null;
  return {
    get version() { return qualityDatabaseVersion; },
    get environment() { return options.environment || '独立 YashanDB 测试库'; },
    async execute(sql, context = {}) {
      const result = await store.request('POST', '/v1/quality/execute', { sql, testRunId: context.testRunId });
      qualityDatabaseVersion = result.databaseVersion || qualityDatabaseVersion;
      return { columns: result.columns || [], rows: result.rows || [], truncated: Boolean(result.truncated) };
    },
  };
}

module.exports = { createYashanDBQualityAdapter, isolatedQualityDatabaseConfigured };
