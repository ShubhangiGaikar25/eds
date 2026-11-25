/**
 * UDEX Token Change Detection + Bundle Download Script
 * Phase 2 — Semi-Automated Token Monitoring
 *
 * What it does:
 * 1. Checks npm for latest @sapudex/design-tokens version
 * 2. If new version found:
 *    a. Downloads css_variables.css → styles/udex/<version>/
 *    b. Downloads font-face.css → styles/udex/<version>/ (with local font paths)
 *    c. Downloads font .woff2 files → styles/fonts/udex/
 *    d. Compares token names → generates diff report
 *    e. Updates head.html CDN links to new version
 *    f. Opens a PR via GitHub API
 * 3. If no new version → exits cleanly
 *
 * Usage:
 *   node scripts/check-udex-updates.js
 *
 * Environment variables (required in CI):
 *   GITHUB_TOKEN — PAT with repo scope
 *   GITHUB_REPOSITORY — owner/repo (e.g. ShubhangiGaikar25/eds)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Config ─────────────────────────────────────────────────

const NPM_REGISTRY_URL = 'https://registry.npmjs.org/@sapudex/design-tokens/latest';
const CDN_BASE = 'https://cdn.udex.services.sap.com/dds/design-tokens';
const THEME = 'sap_glow';

const PATHS = {
  snapshot: join(ROOT, 'udex-tokens-snapshot.json'),
  version: join(ROOT, 'udex-version.json'),
  headHtml: join(ROOT, 'head.html'),
  udexStyles: (version) => join(ROOT, 'styles', 'udex', version),
  udexFonts: join(ROOT, 'styles', 'fonts', 'udex'),
};

// ─── Helpers ────────────────────────────────────────────────

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

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url} — status ${res.status}`);
  return res.text();
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url} — status ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function extractTokenNames(css) {
  return css
    .split('\n')
    .filter((l) => l.trim().startsWith('--'))
    .map((l) => l.trim().split(':')[0].trim());
}

function compareTokens(oldTokens, newTokens) {
  const oldSet = new Set(oldTokens);
  const newSet = new Set(newTokens);
  return {
    added: newTokens.filter((t) => !oldSet.has(t)),
    removed: oldTokens.filter((t) => !newSet.has(t)),
  };
}

// ─── Step 1 — Fetch latest npm version ──────────────────────

async function fetchLatestNpmVersion() {
  console.log('🔍 Checking latest UDEX version on npm...');
  const res = await fetch(NPM_REGISTRY_URL);
  if (!res.ok) throw new Error(`npm registry returned ${res.status}`);
  const data = await res.json();
  return `v${data.version}`;
}

// ─── Step 2a — Download css_variables.css ───────────────────

async function downloadCssVariables(version) {
  const url = `${CDN_BASE}/${version}/themes/${THEME}/css_variables.css`;
  console.log(`📥 Downloading css_variables.css from CDN...`);
  const css = await fetchText(url);
  const dir = PATHS.udexStyles(version);
  ensureDir(dir);
  writeFileSync(join(dir, 'css_variables.css'), css, 'utf8');
  console.log(`✅ Saved → styles/udex/${version}/css_variables.css`);
  return css;
}

// ─── Step 2b — Download font-face.css (rewrite font URLs) ───

async function downloadFontFace(version) {
  const url = `${CDN_BASE}/${version}/css/font-face.css`;
  console.log(`📥 Downloading font-face.css from CDN...`);
  let css = await fetchText(url);

  // Extract font file URLs from font-face.css
  const fontUrls = [...css.matchAll(/url\('([^']+\.woff2[^']*)'\)/g)]
    .map((m) => m[1]);

  console.log(`📥 Found ${fontUrls.length} font file(s) to download...`);

  // Download each font file
  ensureDir(PATHS.udexFonts);
  for (const fontUrl of fontUrls) {
    const fileName = fontUrl.split('/').pop().split('?')[0];
    const buffer = await fetchBuffer(fontUrl);
    const localPath = join(PATHS.udexFonts, fileName);
    writeFileSync(localPath, buffer);
    console.log(`✅ Saved font → styles/fonts/udex/${fileName}`);

    // Rewrite font URL to local path in CSS
    css = css.replace(fontUrl, `/styles/fonts/udex/${fileName}`);
  }

  // Save updated font-face.css with local font paths
  const dir = PATHS.udexStyles(version);
  ensureDir(dir);
  writeFileSync(join(dir, 'font-face.css'), css, 'utf8');
  console.log(`✅ Saved → styles/udex/${version}/font-face.css (with local font paths)`);
}

// ─── Step 2c — Update head.html ─────────────────────────────

function updateHeadHtml(newVersion) {
  console.log(`📝 Updating head.html to use local UDEX files...`);
  let html = readFileSync(PATHS.headHtml, 'utf8');

  // Replace CDN links with local paths
  html = html.replace(
    /https:\/\/cdn\.udex\.services\.sap\.com\/dds\/design-tokens\/[^/]+\/themes\/sap_glow\/css_variables\.css/g,
    `/styles/udex/${newVersion}/css_variables.css`,
  );

  html = html.replace(
    /https:\/\/cdn\.udex\.services\.sap\.com\/dds\/design-tokens\/[^/]+\/css\/font-face\.css/g,
    `/styles/udex/${newVersion}/font-face.css`,
  );

  writeFileSync(PATHS.headHtml, html, 'utf8');
  console.log(`✅ head.html updated to use local styles/udex/${newVersion}/`);
}

// ─── Step 2d — Generate diff report ─────────────────────────

function generateDiffReport({ oldVersion, newVersion, added, removed }) {
  const lines = [
    `## 📦 UDEX Token Change Report`,
    ``,
    `| | |`,
    `|---|---|`,
    `| Previous version | \`${oldVersion}\` |`,
    `| New version | \`${newVersion}\` |`,
    `| Tokens added | ${added.length} |`,
    `| Tokens removed | ${removed.length} |`,
    ``,
  ];

  if (added.length > 0) {
    lines.push(`### ✅ New tokens added (${added.length})`);
    lines.push('```');
    added.forEach((t) => lines.push(t));
    lines.push('```');
    lines.push('');
  }

  if (removed.length > 0) {
    lines.push(`### ❌ Tokens removed (${removed.length})`);
    lines.push('```');
    removed.forEach((t) => lines.push(t));
    lines.push('```');
    lines.push('');
  }

  if (added.length === 0 && removed.length === 0) {
    lines.push('### ✅ No token name changes');
    lines.push('Token VALUES may have changed — check `styles/udex` diff for details.');
    lines.push('');
  }

  lines.push(`### ⚠️ Action Required`);
  lines.push(`1. Review token changes above`);
  lines.push(`2. Check if any tokens in \`styles/styles.css\` were renamed or removed`);
  lines.push(`3. Update \`styles/styles.css\` mappings if needed`);
  lines.push(`4. Preview at \`https://${newVersion.replace('.', '-')}--eds--shubhangigaikar25.aem.page\``);
  lines.push(`5. Test all event pages before merging`);
  lines.push(`6. Rollback = revert this PR`);

  return lines.join('\n');
}

// ─── Step 3 — Open GitHub PR ────────────────────────────────

async function openGitHubPR({ version, oldVersion, diffReport }) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY || 'ShubhangiGaikar25/eds';

  if (!token) {
    console.log('⚠️  No GITHUB_TOKEN found — skipping PR creation.');
    console.log('   Set GITHUB_TOKEN env variable to enable automatic PR creation.');
    return;
  }

  const branch = `udex-${version}`;
  const [owner, repoName] = repo.split('/');

  console.log(`🔀 Creating PR branch: ${branch}...`);

  // Get current main SHA
  const refRes = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/main`,
    { headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' } },
  );
  const refData = await refRes.json();
  const mainSha = refData.object.sha;

  // Create new branch
  await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/refs`,
    {
      method: 'POST',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: mainSha }),
    },
  );
  console.log(`✅ Branch created: ${branch}`);

  // Create PR
  const prRes = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/pulls`,
    {
      method: 'POST',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `chore: udex-${version} — design token update`,
        body: diffReport,
        head: branch,
        base: 'main',
        draft: false,
      }),
    },
  );

  const prData = await prRes.json();
  if (prData.html_url) {
    console.log(`✅ PR created: ${prData.html_url}`);
  } else {
    console.log('⚠️  PR creation response:', JSON.stringify(prData, null, 2));
  }
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  try {
    // Step 1 — Get latest version from npm
    const latestVersion = await fetchLatestNpmVersion();
    console.log(`✅ Latest UDEX version: ${latestVersion}`);

    // Step 2 — Read stored version
    const versionStore = readJSON(PATHS.version);
    const storedVersion = versionStore?.version ?? 'unknown';
    console.log(`📌 Stored version: ${storedVersion}`);

    // Step 3 — Compare versions
    if (latestVersion === storedVersion) {
      console.log('\n✅ UDEX is up to date — no changes detected.');
      process.exit(0);
    }

    console.log(`\n🚨 New UDEX version detected: ${storedVersion} → ${latestVersion}`);

    // Step 4 — Download UDEX files locally
    const newCss = await downloadCssVariables(latestVersion);
    await downloadFontFace(latestVersion);

    // Step 5 — Update head.html
    updateHeadHtml(latestVersion);

    // Step 6 — Compare token names
    const newTokens = extractTokenNames(newCss);
    const snapshot = readJSON(PATHS.snapshot);
    const oldTokens = snapshot?.tokens ?? [];
    const { added, removed } = compareTokens(oldTokens, newTokens);

    console.log(`\n📊 Token diff: +${added.length} added, -${removed.length} removed`);

    // Step 7 — Generate diff report
    const diffReport = generateDiffReport({
      oldVersion: storedVersion,
      newVersion: latestVersion,
      added,
      removed,
    });
    console.log('\n' + diffReport);

    // Step 8 — Update snapshot and version store
    writeJSON(PATHS.snapshot, { version: latestVersion, tokens: newTokens });
    writeJSON(PATHS.version, {
      version: latestVersion,
      lastChecked: new Date().toISOString(),
    });
    console.log('💾 Snapshot and version store updated.');

    // Step 9 — Open GitHub PR
    await openGitHubPR({
      version: latestVersion,
      oldVersion: storedVersion,
      diffReport,
    });

    // Step 10 — Signal GitHub Actions
    if (process.env.GITHUB_OUTPUT) {
      const { appendFileSync } = await import('fs');
      appendFileSync(process.env.GITHUB_OUTPUT, `changes=true\nnew_version=${latestVersion}\n`);
    }

    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(2);
  }
}

main();