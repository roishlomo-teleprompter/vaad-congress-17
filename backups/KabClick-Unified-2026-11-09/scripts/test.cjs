const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const dir = path.resolve(__dirname, '../tests');
for (const name of fs.readdirSync(dir).filter(n => n.endsWith('.cjs')).sort()) {
  const result = spawnSync(process.execPath, [path.join(dir, name)], {stdio: 'inherit'});
  if (result.status !== 0) process.exit(result.status || 1);
}
