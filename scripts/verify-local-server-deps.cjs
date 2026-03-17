/**
 * Pre-build verification script for Local Server packaging.
 * Ensures critical runtime modules are resolvable before electron-builder runs.
 */

const requiredModules = ['express', 'cors', 'better-sqlite3'];
const missing = [];

for (const mod of requiredModules) {
  try {
    require.resolve(mod);
    console.log(`  ✓ ${mod}`);
  } catch {
    console.error(`  ✗ ${mod} — NOT FOUND`);
    missing.push(mod);
  }
}

if (missing.length > 0) {
  console.error(`\n❌ Missing ${missing.length} module(s): ${missing.join(', ')}`);
  console.error('Run "npm install" before building.\n');
  process.exit(1);
} else {
  console.log('\n✅ All local server dependencies verified.\n');
}
