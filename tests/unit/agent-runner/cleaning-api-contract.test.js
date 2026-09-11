const fs = require('fs');
const path = require('path');

describe('资料加工统一入口上传 API 客户端契约', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/common/api/cleaning-api.js'), 'utf8');
  test('上传会话链路覆盖创建、文件登记、分块、完成和批次创建', () => {
    for (const token of ['createUploadSession', 'addUploadFile', 'uploadChunk', 'completeUploadFile', 'completeUploadSession', 'createUploadBatch']) expect(source).toContain(token);
    expect(source).toContain("'/upload-sessions'");
    expect(source).toContain("'Idempotency-Key'");
    expect(source).toContain("'application/octet-stream'");
  });
});
