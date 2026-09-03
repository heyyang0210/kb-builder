#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DatabaseRecordStore } = require('../lib/database-record-store');

async function main() {
  const outputArg = process.argv[2];
  if (!outputArg) throw new Error('请提供导出文件路径');
  const output = path.resolve(outputArg);
  const directory = path.dirname(output);
  fs.mkdirSync(directory, { recursive: true });
  const data = await new DatabaseRecordStore({ timeoutMs: Number(process.env.YASDB_STORAGE_EXPORT_TIMEOUT_MS || 30000) }).exportAll();
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  const temporary = `${output}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, serialized, { mode: 0o600 });
  fs.renameSync(temporary, output);
  const sha256 = crypto.createHash('sha256').update(serialized).digest('hex');
  fs.writeFileSync(`${output}.sha256`, `${sha256}  ${path.basename(output)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ success: true, output, recordCount: data.records?.length || 0, sha256 }, null, 2)}\n`);
}

main().catch(error => {
  process.stderr.write(`导出失败：${error.message}\n`);
  process.exitCode = 1;
});
