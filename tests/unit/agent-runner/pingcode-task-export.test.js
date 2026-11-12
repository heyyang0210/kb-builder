const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const AdmZip = require('adm-zip');
const { taskCsv, sourceArchive, sourceDocument } = require('../../../packages/agent-runner-core/lib/pingcode-task-export');

test('CSV keeps the fixed columns and escapes formulas, quotes and newlines', () => {
  const csv = taskCsv([{ number: 'YDBRD-1', ir: ['YASHAN-1'], description: '=HYPERLINK("x")\nnext',
    ownerName: '甲', sourceType: 'REQUIREMENT', sourceUrl: 'https://pingcode.yasdb.com/test' }]);
  expect(csv).toMatch(/^\uFEFF"编号","IR","描述"/);
  expect(csv).toContain('"\'=HYPERLINK(""x"")\nnext"');
  expect(csv).toContain('"需求"');
});

test('export replaces a failed image with a visible missing marker', () => {
  const url = 'https://pingcode.yasdb.com/atlas/files/public/missing.png';
  const document = sourceDocument({ number: 'YDBRD-1', markdown: `![示意图](${url})`,
    resources: [{ id: crypto.createHash('sha256').update(url).digest('hex'), state: 'FAILED',
      path: url, errorCode: 'PINGCODE_IMAGE_UNAVAILABLE' }] });
  expect(document).toContain('[图片未能读取：示意图]');
  expect(document).not.toContain(url);
});

test('repaired image is included in ZIP and Markdown points to the local verified bytes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pingcode-export-'));
  try {
    const bytes = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(path.join(root, hash), bytes);
    const remote = 'https://pingcode.yasdb.com/atlas/files/public/repaired.png';
    const archive = sourceArchive({ number: 'YDBRD-2', markdown: `![示意图](${remote})`,
      resources: [{ id: crypto.createHash('sha256').update(remote).digest('hex'), state: 'READY',
        path: `assets/${hash}.png`, contentType: 'image/png', byteCount: bytes.length }] }, root);
    expect(archive.filename).toBe('YDBRD-2.zip');
    const zip = new AdmZip(archive.data);
    expect(zip.readAsText('YDBRD-2.md')).toContain(`![示意图](assets/${hash}.png)`);
    expect(zip.readFile(`assets/${hash}.png`)).toEqual(bytes);
    expect(zip.readAsText('manifest.json')).toContain(hash);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
