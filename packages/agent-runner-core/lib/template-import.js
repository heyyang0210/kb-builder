const path = require('path');
const MAX_FILE = 10 * 1024 * 1024;
const MAX_REQUEST = 40 * 1024 * 1024;
function uploadError(code, message, status = 422) { return Object.assign(new Error(message), { code, status }); }
async function readTemplateUpload(req) {
  const Busboy = require('busboy');
  return new Promise((resolve, reject) => {
    let parser;
    try { parser = Busboy({ headers: req.headers, defParamCharset: 'utf8', limits: { files: 20, fields: 3, fieldSize: 8192, parts: 24 } }); }
    catch (_) { reject(uploadError('TEMPLATE_INVALID_UPLOAD', '请使用 multipart/form-data 上传模板', 400)); return; }
    const files = []; const fields = {}; let batch = false; let total = 0; let envelopeError;
    const fail = error => { envelopeError ||= error; };
    const count = chunk => {
      total += chunk.length;
      if (total > MAX_REQUEST) {
        fail(uploadError('TEMPLATE_REQUEST_TOO_LARGE', '单次请求不能超过40MB', 413));
        req.unpipe(parser); parser.destroy(envelopeError); req.resume();
      }
    };
    req.on('data', count);
    req.once('aborted', () => parser.destroy(uploadError('TEMPLATE_UPLOAD_ABORTED', '上传已中断', 400)));
    parser.on('field', (name, value, info) => {
      if (!['name', 'type', 'description'].includes(name) || info.valueTruncated) fail(uploadError('TEMPLATE_INVALID_UPLOAD', '上传字段不合法或过长', 400));
      else fields[name] = value;
    });
    parser.on('file', (field, stream, info) => {
      batch ||= field === 'files';
      if (!['files', 'file'].includes(field)) fail(uploadError('TEMPLATE_INVALID_UPLOAD', '文件字段必须为 files 或 file', 400));
      const rawFilename = String(info.filename || '未命名.md');
      const decodedFilename = /[ÃÂ]/.test(rawFilename) ? Buffer.from(rawFilename, 'latin1').toString('utf8') : rawFilename;
      const sourceFilename = path.basename(decodedFilename.replace(/\\/g, '/'));
      const item = { clientIndex: files.length, sourceFilename }; files.push(item);
      const ext = path.extname(sourceFilename).toLowerCase();
      let chunks = []; let size = 0;
      if (!['.md', '.markdown'].includes(ext)) item.error = uploadError('TEMPLATE_FORMAT_UNSUPPORTED', '仅支持 Markdown（.md/.markdown）文件', 415);
      stream.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_FILE) { item.error = uploadError('TEMPLATE_FILE_TOO_LARGE', '单个文件不能超过10MB', 413); chunks = []; }
        if (!item.error) chunks.push(chunk);
      });
      stream.on('end', () => {
        if (item.error) return;
        try { item.content = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
        catch (_) { item.error = uploadError('TEMPLATE_ENCODING_INVALID', '请上传 UTF-8 编码的 Markdown 文本'); }
      });
    });
    for (const event of ['filesLimit', 'fieldsLimit', 'partsLimit']) parser.on(event, () => fail(uploadError('TEMPLATE_INVALID_UPLOAD', '一次最多20个文件及3个元数据字段', 413)));
    parser.on('error', () => { req.removeListener('data', count); reject(envelopeError || uploadError('TEMPLATE_INVALID_UPLOAD', '上传请求不完整或格式错误', 400)); });
    parser.on('close', () => {
      req.removeListener('data', count);
      if (envelopeError) return reject(envelopeError);
      if (!files.length) return reject(uploadError('TEMPLATE_FILE_REQUIRED', '请上传模板文件', 400));
      resolve({ batch, files: files.map(item => ({ ...fields, ...item, name: fields.name || path.basename(item.sourceFilename, path.extname(item.sourceFilename)), warnings: [] })) });
    });
    req.pipe(parser);
  });
}
module.exports = { readTemplateUpload };
