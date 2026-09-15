const fs = require('fs');
const path = require('path');
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function writeJsonAtomic(filePath, value, mode = 0o600) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode });
  fs.renameSync(temporary, filePath);
}
module.exports = { readJson, writeJsonAtomic };
