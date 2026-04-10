/**
 * Pre-build verification script for Local Server packaging.
 * Ensures critical runtime modules are resolvable before electron-builder runs.
 * Also validates that key server files exist.
 */

const path = require('path');
const fs = require('fs');

console.log('=== Local Server Pre-Build Verification ===\n');

// 1. Check required npm modules
const requiredModules = ['express', 'cors', 'better-sqlite3'];
const missingModules = [];

console.log('--- Module Resolution ---');
for (const mod of requiredModules) {
  try {
    const resolved = require.resolve(mod);
    console.log(`  ✓ ${mod} → ${resolved}`);
  } catch {
    console.error(`  ✗ ${mod} — NOT FOUND`);
    missingModules.push(mod);
  }
}

// 2. Check critical server files exist
const criticalFiles = [
  'server/index.js',
  'server/lib/controlid.js',
  'server/routes/access-logs.js',
  'server/routes/workers.js',
  'server/routes/devices.js',
  'server/routes/sync.js',
  'electron/local-server-main.js',
  'electron/database.js',
  'electron/sync.js',
  'electron/agent.js',
  'electron/server-preload.js',
  'electron/server-ui.html',
];
const missingFiles = [];

console.log('\n--- Critical Files ---');
for (const file of criticalFiles) {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✓ ${file}`);
  } else {
    console.error(`  ✗ ${file} — MISSING`);
    missingFiles.push(file);
  }
}

// 3. Check better-sqlite3 native binary
console.log('\n--- Native Binary ---');
try {
  const bindingPath = require.resolve('better-sqlite3/build/Release/better_sqlite3.node');
  const stat = fs.statSync(bindingPath);
  console.log(`  ✓ better_sqlite3.node (${Math.round(stat.size / 1024)} KB) → ${bindingPath}`);
} catch {
  try {
    const prebuildPath = require.resolve('better-sqlite3/prebuilds');
    console.log(`  ~ better_sqlite3.node via prebuilds → ${prebuildPath}`);
  } catch {
    console.error('  ✗ better_sqlite3.node — NOT FOUND (native binary missing)');
    missingModules.push('better-sqlite3 native binary');
  }
}

// Summary
console.log('');
const totalErrors = missingModules.length + missingFiles.length;
if (totalErrors > 0) {
  if (missingModules.length) console.error(`❌ Missing ${missingModules.length} module(s): ${missingModules.join(', ')}`);
  if (missingFiles.length) console.error(`❌ Missing ${missingFiles.length} file(s): ${missingFiles.join(', ')}`);
  console.error('\nRun "npm install" before building.\n');
  process.exit(1);
} else {
  console.log('✅ All local server dependencies and files verified.\n');
}
