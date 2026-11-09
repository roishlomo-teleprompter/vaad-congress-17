const {spawnSync} = require('node:child_process');
const path = require('node:path');
const [action, platform] = process.argv.slice(2);
if (!['sync', 'copy', 'open'].includes(action) || !['ios', 'android'].includes(platform)) {
  console.error('Usage: node scripts/native.cjs <sync|copy|open> <ios|android>');
  process.exit(1);
}
const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor');
const result = spawnSync(process.execPath, [cli, action, platform], {
  cwd: root,
  env: {...process.env, KABCLICK_PLATFORM: platform},
  stdio: 'inherit'
});
if (result.error) { console.error(result.error.message); process.exit(1); }
process.exit(result.status ?? 1);
