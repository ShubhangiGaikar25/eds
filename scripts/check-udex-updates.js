/**
 * UDEX Token Change Detection Script
 * Phase 2 — Semi-Automated Token Monitoring
 *
 * Checks if UDEX has released a new version and compares
 * token names against the stored snapshot.
 *
 * Usage:
 *   node scripts/check-udex-updates.js
 *
 * Output:
 *   - Prints a change report to the console
 *   - Sets process.env.CHANGES_FOUND = 'true' if changes detected
 *   - Writes updated snapshot if version changed
 *   - Exits with code 1 if changes found (triggers GitHub Actions step)
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const NPM_REGISTRY_URL = 'https://registry.npmjs.org/@sapudex/design-tokens/latest';
const CDN_BASE = 'https://cdn.udex.services.sap.com/dds/design-tokens';
const THEME = 'sap_glow';
const SNAPSHOT_PATH = join(ROOT, 'udex-tokens-snapshot.json');
const VERSION_PATH = join(ROOT, 'udex-version.json');

// ─── Helpers ────────────────────────────────────────────────

async function fetchLatestNpmVersion() {
  console.log('🔍 Checking latest UDEX version on npm...');
  const res = await fetch(NPM_REGISTRY_URL);
  if (!res.ok) throw new Error(`npm registry returned ${res.status}`);
  const data = await res.json();
  return `v${data.version}`;
}

async function fetchTokenNames(version) {
  const url = `${CDN_BASE}/${version}/themes/${THEME}/css_variables.css`;
  console.log(`📥 Fetching tokens from CDN: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CDN returned ${res.status} for ${url}`);
  const css = await res.text();
  return css
    .split('\n')
    .filter((l) => l.trim().startsWith('--'))
    .map((l) => l.trim().split(':')[0].trim());
}

function readJSON(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function compareTokens(oldTokens, newTokens) {
  const oldSet = new Set(oldTokens);
  const newSet = new Set(newTokens);
  return {
    added: newTokens.filter((t) => !oldSet.has(t)),
    removed: oldTokens.filter((t) => !newSet.has(t)),
  };
}

function printReport({ oldVersion, newVersion, added, removed }) {
  console.log('\n' + '─'.repeat(60));
  console.log('📦 UDEX Token Change Report');
  console.log('─'.repeat(60));
  console.log(`  Previous version : ${oldVersion}`);
  console.log(`  New version      : ${newVersion}`);
  console.log(`  Total tokens     : ${added.length + removed.length} changes`);
  console.log('─'.repeat(60));

  if (added.length > 0) {
    console.log(`\n✅ New tokens added (${added.length}):`);
    added.forEach((t) => console.log(`   ${t}`));
  }

  if (removed.length > 0) {
    console.log(`\n❌ Tokens removed (${removed.length}):`);
    removed.forEach((t) => console.log(`   ${t}`));
  }

  if (added.length === 0 && removed.length === 0) {
    console.log('\n✅ No token name changes detected.');
    console.log('   Token VALUES may have changed — check the CDN diff for details.');
  }

  console.log('\n' + '─'.repeat(60));

  if (added.length > 0 || removed.length > 0) {
    console.log('⚠️  Action needed:');
    console.log('   1. Review added/removed tokens above');
    console.log('   2. Update styles/styles.css mappings if needed');
    console.log('   3. Test on exercise-demo branch before merging to main');
    console.log('─'.repeat(60));
  }
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  try {
    // Step 1 — Get latest version from npm
    const latestVersion = await fetchLatestNpmVersion();
    console.log(`✅ Latest UDEX version: ${latestVersion}`);

    // Step 2 — Read stored version
    const versionStore = readJSON(VERSION_PATH);
    const storedVersion = versionStore?.version ?? 'unknown';
    console.log(`📌 Stored version: ${storedVersion}`);

    // Step 3 — Compare versions
    if (latestVersion === storedVersion) {
      console.log('\n✅ UDEX is up to date — no changes detected.');
      console.log(`   Current version: ${storedVersion}`);
      process.exit(0);
    }

    console.log(`\n🚨 New UDEX version detected: ${storedVersion} → ${latestVersion}`);

    // Step 4 — Fetch new tokens from CDN
    const newTokens = await fetchTokenNames(latestVersion);
    console.log(`✅ Fetched ${newTokens.length} tokens from CDN`);

    // Step 5 — Load stored snapshot
    const snapshot = readJSON(SNAPSHOT_PATH);
    const oldTokens = snapshot?.tokens ?? [];
    console.log(`📌 Stored snapshot has ${oldTokens.length} tokens`);

    // Step 6 — Compare token names
    const { added, removed } = compareTokens(oldTokens, newTokens);

    // Step 7 — Print report
    printReport({
      oldVersion: storedVersion,
      newVersion: latestVersion,
      added,
      removed,
    });

    // Step 8 — Update snapshot and version store
    writeJSON(SNAPSHOT_PATH, { version: latestVersion, tokens: newTokens });
    writeJSON(VERSION_PATH, {
      version: latestVersion,
      lastChecked: new Date().toISOString(),
    });
    console.log('💾 Snapshot and version store updated.');

    // Step 9 — Signal GitHub Actions that changes were found
    // Write to GITHUB_OUTPUT if running in CI
    if (process.env.GITHUB_OUTPUT) {
      const { appendFileSync } = await import('fs');
      appendFileSync(process.env.GITHUB_OUTPUT, 'changes=true\n');
    }

    // Exit with code 1 to signal changes found
    process.exit(1);

  } catch (err) {
    console.error('❌ Error running UDEX update check:', err.message);
    process.exit(2);
  }
}

main();