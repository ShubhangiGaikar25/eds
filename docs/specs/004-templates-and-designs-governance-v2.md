# 004 - Templates and Designs Governance POC

## Overview

This document captures the analysis, implementation details, learnings, and next steps for the **Templates and Designs Governance POC**—integrating SAP UDEX (Unified Design Experience) design tokens into an Edge Delivery Services (EDS) site with automated design sync capabilities.

---

## Objective

Build an EDS-based site that:

- Reads the latest designs from the UDEX shared library.
- Automatically stays in sync with UDEX design updates.
- Periodically detects and applies token changes without manual intervention.
- Validates design alignment through governance checks.
- Enforces design governance so event owners can change content and images only—not colours, fonts, or layout rules.

---

## Scope

| Item | Status |
|---|---|
| UDEX CDN Integration | ✅ Done |
| Basic Token Mapping in `styles.css` | ✅ Done |
| UDEX-Aligned Template Page | ✅ Done |
| EDS Block Fixes (accordion, card) | ✅ Done |
| CSP Configuration | ✅ Done |
| DA Access Configuration | ✅ Done |
| Governance Check (basic) | ✅ Done |
| Complete UDEX Token Mapping (all categories) | ✅ Done |
| Header/Footer Guard—improved (any value + locale prefixes) | ✅ Done |
| CDN version pinned to `v2.64.0` | ✅ Done |
| UDEX files hosted locally (no CDN dependency) | ✅ Done |
| Semi-Automated Token Monitoring | ✅ Done |
| Folder Permissions for Shared Parts | 🔜 Task 3 (approach corrected) |
| Event Template Set Structure | 🔜 Task 4 (pending client) |
| UDEX Level 2 + Level 3 blocks | 🔜 Task 5 (new) |
| Fully Automated Design Sync | 🔜 Phase 3 (scope reduced) |

---

## Requirement Summary (from client, 2026-11-12)

- All standard templates follow the SAP brand—one theme, many events.
- Templates use UDEX as the design reference.
- Owners pick a template and change content and images only—**not** colours, fonts, or layout rules.
- Header and footer are locked; more locked areas will follow from business rules.
- The block-library owner is a designer (to be named), with a process like `sap.com`'s.
- Designs and template governance still need to be agreed with the business.
- One gap was identified: a page can switch off or replace the header/footer through page metadata (`header: off`). Locking the fragment is not enough; event pages need a code guard.

---

## Phase 1 — Manual Sync (COMPLETED ✅)

### 1.1 UDEX CDN Integration

Initially added CDN links to `head.html` pinned to fixed version `v2.64.0`. Later superseded by local hosting (see section 1.14).

**Why pin to a fixed version?**

Using `latest` means every UDEX release hits live event pages within approximately one day—completely untested. SAP's own team uses pinned versions. Version upgrades go through the Phase 2 CI process with human approval.

> **Important:** Use `v2.64.0` **with** the `v` prefix. `/2.64.0/` returns 404.

---

### 1.2 UDEX Architecture — 3 Levels

UDEX integration has three levels. Use the right level for each block type:

| Level | What | Used for | Cost |
|---|---|---|---|
| **1 — Tokens** | CSS variables only, fixed version | Colors, type, spacing everywhere | No JS cost |
| **2 — Plain HTML styled as UDEX** | Normal HTML that looks like UDEX | Hero, cards, FAQ—fast, SEO-friendly, editable in EW | No JS cost |
| **3 — UDEX Web Components** | Pre-bundled, fixed version, loaded only when needed | Interactive: search, date pickers, registration wizard | JS cost—load only when needed |

**Rule:** Content blocks → Level 2. Interactive blocks → Level 3.

---

### 1.3 Key Token Discovery Learnings

During implementation, several incorrect assumptions were corrected:

| Assumption | Reality |
|---|---|
| Font token is `--udexTypographyFontFamily` | Actual token is `--sapFontFamily` |
| Font name is `"SAP72"` | Actual font name is `"72 Brand Variable"` |
| All tokens use the `--udex...` prefix | Core tokens use the `--sap...` prefix |
| Heading tokens use `--udexTypographyHeading...` | Actual tokens are `--sapFontHeader1Size`, etc. |
| Spacer `--udexSpacer2` = `0.5rem` | Actual value is `2px`—the number is the pixel value |
| Shadow tokens are `--udexShadowLvl1` | Actual tokens are `--sapContent_Shadow0`, etc. |
| Border-radius tokens are `--udexBorderRadiusSm` | Actual tokens are `--udexRadiusXS`, etc. |
| The `latest` CDN path is safe to use | Pin to a fixed version, for example `v2.64.0` |

**How tokens were discovered:**

```javascript
fetch('https://cdn.udex.services.sap.com/dds/design-tokens/v2.64.0/themes/sap_glow/css_variables.css')
  .then((r) => r.text())
  .then((t) => {
    const lines = t
      .split('\n')
      .filter((l) => l.toLowerCase().includes('font'));

    console.log(lines.slice(0, 30).join('\n'));
  });
```

**Total tokens in the `sap_glow` theme: 1,197.**

---

### 1.4 Content Security Policy (CSP) Fix

Initially updated the CSP in `head.html` to allow the UDEX CDN. After moving to local hosting (section 1.14), the CDN domain was removed and `'self'` is now sufficient:

```text
style-src 'self' 'unsafe-inline';
font-src  'self';
```

Removing the CDN domain from CSP reduces the attack surface and removes the external dependency entirely.

---

### 1.5 UDEX-Aligned Template Page

Created `templates/udex-page-template.html` in DA with these sections:

| Section | Block Used | UDEX Level | Purpose |
|---|---|---|---|
| Hero | `hero center` | Level 2 | Page title, description, CTA with image |
| Feature Cards | `card` | Level 2 | Three feature cards |
| Two Column | `columns` | Level 2 | Side-by-side content |
| FAQ | `accordion` | Level 2 | Expandable Q&A items |
| CTA | Plain section | Level 2 | Call to action |
| Metadata | `metadata` | — | SEO title, description, template tag |

---

### 1.6 EDS Block Fixes

**Corrected learning from review:** The reviewer clarified that Author Kit loads each block's **default export, whatever it is called**. Renaming `init` to `decorate` did **not** fix the block errors. The real cause was a **block name/folder name mismatch** (`cards` vs. `card`).

```javascript
// The function name does NOT matter to Author Kit.
// Author Kit calls the DEFAULT EXPORT—whatever it is named.
export default function init(el) { /* ... */ }      // ✅ Works
export default function decorate(el) { /* ... */ }  // ✅ Also works

// What DOES matter:
// The block class name in HTML must EXACTLY match the folder/file name.
// <div class="card">...</div>  → blocks/card/card.js ✅
// <div class="cards">...</div> → blocks/card/card.js ❌ MISMATCH
// This mismatch was the real bug.
```

---

### 1.7 DA Access Configuration

Created a `.da/config` sheet to control repository access:

| key | value |
|---|---|
| admin | `s.suresh.gaikar@accenture.com` |
| edit | `retesh.singh@accenture.com` |

**Important notes:**

- The sheet tab must be named exactly `config` (lowercase).
- Org-level config (`da.live/config#/org`) ≠ site-level config (`.da/config`).
- Config sheets do **not** need to be previewed; saving is sufficient.
- The DA `.da` folder is hidden in the file browser but accessible via direct URL.

---

### 1.8 Governance Check Results

| Check | Result |
|---|---|
| H1 Count | ✅ Pass |
| Lorem Ipsum | ✅ Pass |
| SEO Title | ✅ Pass |
| SEO Description | ✅ Pass |

> **Note:** AI-powered brand checks require a brand configured in Experience Context.

---

### 1.9 Complete UDEX Token Mapping (COMPLETED ✅)

Full verified token mapping in `styles/styles.css`.

**Verified token values:**

| Token | Value |
|---|---|
| `--color-brand-primary` | ✅ `#0070F2` |
| `--color-text` | ✅ `#223548` |
| `--color-link` | ✅ `#0057D2` |
| `--color-button-background` | ✅ `#FFFFFF` |
| `--spacing-xs` | ✅ `4px` |
| `--spacing-md` | ✅ `16px` |
| `--spacing-xxl` | ✅ `48px` |
| `--shadow-sm` | ✅ `0px 2px 4px 0px rgba(34,53,72,0.2)` |
| `--shadow-md` | ✅ `0px 2px 8px 0px rgba(34,53,72,0.3)` |

**Token categories mapped:**

- Colors: brand, highlight, background, text, link, button, border, and tile.
- Typography: font families (base, header, bold, light), headings H1–H6, and body XXS–base.
- Spacing: full `--udexSpacer*` scale (2px–96px) plus semantic aliases.
- Grid margins: XS–XL.
- Border radius: XXS–XXL plus component-specific values (button, field, tile).
- Border width: XS, SM.
- Shadows: SM, MD, LG, XL.

---

### 1.10 Header/Footer Guard (COMPLETED ✅ — improved)

**Problem:** EDS honours `header: off` or `header: /other/nav` metadata on any page, including event pages. Locking the fragment files is not enough.

**Initial implementation gap:** The first implementation blocked only `off` and empty values. It did **not** block fragment-path swaps or locale-prefixed paths.

**Improved solution in `scripts/scripts.js`:**

```javascript
// Guard: prevent event pages from overriding header or footer via metadata.
// Covers:
// - Any value (not just "off"), including fragment-path swaps.
// - Locale prefixes: /de/events/, /fr/events/, /es/events/, etc.
function guardEventPageLayout() {
  const path = window.location.pathname;

  // Match /events/ with an optional locale prefix.
  const isEventPage = /^\/([\w-]+\/)?events\//.test(path);
  if (!isEventPage) return;

  // Remove ANY header or footer meta tag, regardless of value.
  const metaTags = document.querySelectorAll(
    'meta[name="header"], meta[name="footer"]',
  );

  metaTags.forEach((meta) => {
    const name = meta.getAttribute('name');
    const value = meta.getAttribute('content')?.trim();
    console.warn(`[Guard] Blocked "${name}: ${value}" on event page ${path}`);
    meta.remove();
  });
}

// Run immediately before EDS processes meta tags.
guardEventPageLayout();
```

**Test results—all eight paths verified:**

| Path | Expected | Result |
|---|---|---|
| `/events/test-event/` | `isEventPage: true` | ✅ |
| `/de/events/my-event/` | `isEventPage: true` | ✅ |
| `/fr/events/my-event/` | `isEventPage: true` | ✅ |
| `/es/events/my-event/` | `isEventPage: true` | ✅ |
| `/zh/events/my-event/` | `isEventPage: true` | ✅ |
| `/templates/udex-page-template` | `isEventPage: false` | ✅ |
| `/fragments/nav/header` | `isEventPage: false` | ✅ |
| `/index` | `isEventPage: false` | ✅ |

**Fragment swap also blocked:**

```text
Before guard: header meta: off, footer meta: /some/other/nav
[Guard] Blocking "header: off"
[Guard] Blocking "footer: /some/other/nav"
After guard: header meta: null, footer meta: null ✅
```

**Key learning:** EDS converts the `.metadata` block to `<meta>` tags before scripts run. The guard must check `<meta>` tags, not `.metadata` `div` elements.

---

### 1.11 Folder Permissions for Shared Parts (🔜 TODO — approach corrected)

**Previous approach was wrong:** The plan was to create a `config` sheet inside each folder. DA has **no per-folder config sheets**.

**Correct approach:** All permissions live in one `permissions` sheet in the **org config** at [https://da.live/config#/](https://da.live/config#/). The sheet has the columns `path`, `groups`, and `actions`:

| path | groups | actions |
|---|---|---|
| `//fragments/**` | `/admins` | `write` |
| `//templates/**` | `/admins` | `write` |
| `//schedules/**` | `/admins` | `write` |
| `//events/**` | Event owners group | `write` |

**Blocked by:** Need the `/admins` and event owner group IDs from the DA org admin (Q18).

---

### 1.12 Event Template Set Structure (🔜 TODO — pending client input)

| Template | Path | Status |
|---|---|---|
| Landing page | `templates/event-landing` | Pending |
| Agenda page | `templates/event-agenda` | Pending |
| Speakers page | `templates/event-speakers` | Pending |
| Sponsors page | `templates/event-sponsors` | Pending |
| Registration page | `templates/event-registration` | Pending (topic 08) |
| Thank-you page | `templates/event-thankyou` | Pending (topic 08) |
| FAQ page | `templates/event-faq` | Pending |

**Blocked by:** Client alignment on template rules—required vs. optional sections for each template.

---

### 1.13 UDEX Level 2 + Level 3 Blocks (🔜 TODO — new task from review)

**Goal:** Build a test page with a Level 2 hero and a Level 3 date-picker block, and check:

- Page speed score.
- EW in-place editing with UDEX web components (Shadow DOM conflict risk—Q11).
- Performance impact of the web-component JavaScript bundle.

**Blocked by:** Answers to Q11 (Shadow DOM + EW editing) and Q6 (whether UDEX can be served publicly).

---

### 1.14 UDEX Files Hosted Locally (COMPLETED ✅)

**Problem:** Loading UDEX CSS and font files directly from the CDN on every page load creates a cross-origin request that blocks first paint and introduces an external dependency.

**Solution:** Download and commit UDEX files directly into the repository.

**Folder structure:**

```text
styles/
├── udex/
│   └── v2.64.0/
│       ├── css_variables.css   ← downloaded from CDN
│       └── font-face.css       ← downloaded from CDN (font URLs rewritten to local)
└── fonts/
    └── udex/
        └── 72BrandVariable_Th-Blk.woff2  ← downloaded from CDN
```

**Updated `head.html`:**

```html
<!-- UDEX files served locally — no CDN dependency -->
<link rel="stylesheet" href="/styles/udex/v2.64.0/font-face.css">
<link rel="stylesheet" href="/styles/udex/v2.64.0/css_variables.css">
```

**Font URL rewritten in `font-face.css`:**

```css
/* BEFORE — CDN */
src: url('https://cdn.udex.services.sap.com/dds/design-tokens/assets/fonts/72BrandVariable_Th-Blk.woff2');

/* AFTER — local */
src: url('/styles/fonts/udex/72BrandVariable_Th-Blk.woff2');
```

**CSP updated — CDN domain removed:**

```text
style-src 'self' 'unsafe-inline';
font-src  'self';
```

**Verified in browser console:**

```text
// All UDEX files now load from local repo
https://.../styles/udex/v2.64.0/css_variables.css  ✅ local
https://.../styles/udex/v2.64.0/font-face.css       ✅ local

// Font still resolving correctly
Font: "72 Brand Variable", Arial, Helvetica, sans-serif  ✅

// All tokens intact
Brand color:  #0070F2  ✅
Text color:   #223548  ✅
Spacing md:   16px     ✅
CDN dependency: ✅ fully local
```

**How Phase 2 CI handles future upgrades:** When a new UDEX version is detected, the CI script automatically downloads the new files, rewrites font paths, updates `head.html`, and opens a PR—no manual steps needed.

---

## Phase 2 — Semi-Automated Token Change Detection (COMPLETED ✅)

### Goal

A weekly CI job that detects new UDEX versions, downloads updated files locally, compares token names, and opens a pull request with all changes for human review and approval.

### What Was Built

#### 1. Version Store — `udex-version.json`

Stores the currently deployed UDEX version:

```json
{
  "version": "v2.64.0",
  "lastChecked": "2025-01-01T00:00:00.000Z"
}
```

#### 2. Token Snapshot — `udex-tokens-snapshot.json`

Stores all 1,197 token names from `v2.64.0` as a baseline for future comparison.

#### 3. Monitoring Script — `scripts/check-udex-updates.js`

What the script does on each run:

1. Checks the npm registry for the latest `@sapudex/design-tokens` version.
2. If it is the same as the stored version, exits cleanly with no action needed.
3. If a new version is found:
   - Downloads `css_variables.css` to `styles/udex/<version>/`.
   - Downloads `font-face.css` to `styles/udex/<version>/` and rewrites font URLs to local paths.
   - Downloads `.woff2` font files to `styles/fonts/udex/`.
   - Updates `head.html` to point to the new version.
   - Compares token names and generates a diff report.
   - Updates `udex-tokens-snapshot.json` and `udex-version.json`.
   - Opens a PR via the GitHub API titled `chore: udex-<version>`.

**How to run manually:**

```bash
node scripts/check-udex-updates.js
```

**How to simulate a version change for testing:**

```bash
# 1. Edit udex-version.json — change version to v2.63.0
# 2. Run the script
node scripts/check-udex-updates.js
# 3. Revert udex-version.json back to v2.64.0
```

#### 4. GitHub Actions Workflow — `.github/workflows/check-udex.yml`

```yaml
name: Check UDEX Design Token Updates

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9:00 UTC
  workflow_dispatch:       # Allow manual trigger

jobs:
  check-udex:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.UDEX_GITHUB_TOKEN }}
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Run UDEX token check
        id: check
        env:
          GITHUB_TOKEN: ${{ secrets.UDEX_GITHUB_TOKEN }}
          GITHUB_REPOSITORY: ${{ github.repository }}
        run: node scripts/check-udex-updates.js
        continue-on-error: true
      - name: Commit downloaded UDEX files if changes found
        if: steps.check.outputs.changes == 'true'
        run: |
          git config user.name "UDEX Token Monitor"
          git config user.email "udex-monitor@noreply.github.com"
          git add styles/udex/ styles/fonts/udex/ head.html udex-tokens-snapshot.json udex-version.json
          git commit -m "chore: update UDEX bundles"
          git push origin HEAD
```

### Change Report Format

When a new version is detected, the script outputs:

```text
📦 UDEX Token Change Report
────────────────────────────────────────────────────────────
  Previous version : v2.64.0
  New version      : v2.65.0
  Total tokens     : 3 changes
────────────────────────────────────────────────────────────

✅ New tokens added (3):
   --udexNewColorToken
   --udexNewSpacingToken
   --udexNewBorderToken

❌ Tokens removed (1):
   --udexOldColorToken

⚠️ Action needed:
   1. Review added/removed tokens above
   2. Update styles/styles.css mappings if needed
   3. Test on exercise-demo branch before merging to main
────────────────────────────────────────────────────────────
```

### Rollback Strategy

Rollback = **revert the PR**. No content republishing is needed—only code changes.

### Test Results

| Test | Result |
|---|---|
| Script runs with no changes | ✅ Exits cleanly |
| Version change simulation | ✅ Downloads files, generates diff, updates `head.html` |
| GitHub Actions manual trigger | ✅ Job succeeds |
| UDEX files load from local repo | ✅ Confirmed in browser console |
| CDN dependency removed | ✅ Confirmed |

---

## Phase 3 — Design Sync (REVISED SCOPE 🔜)

### Revised Goal

Phase 3 scope has been **reduced** based on reviewer feedback. Auto-rewriting `styles.css` and DA templates conflicts with governance requirements—templates are content and must **not** be changed automatically.

### Revised Scope

- ✅ **Keep:** Weekly CI job opens a pull request with a token diff (Phase 2 delivers most of the benefit).
- ✅ **Keep:** Governance validation checks on all pages.
- ✅ **Keep:** Notification system for changes.
- ❌ **Removed:** Bot auto-rewrites `styles.css`; changes must remain human-approved.
- ❌ **Removed:** Bot auto-updates DA templates; templates are content, not code.

### Revised Architecture

```text
UDEX npm registry
        ↓
Weekly CI job (GitHub Actions)
        ↓
Token Diff Engine (compare snapshots)
        ↓
PR opened with diff report
        ↓
Human reviews and approves ← must remain a human step
        ↓
Merged to main → Governance checks run on all pages
        ↓
Notification sent—pages needing review are flagged
```

---

## Open Questions (Pending)

### Blocking — Cannot Proceed Without These

| # | Question | Owner | Blocks |
|---|---|---|---|
| Q1 | Does the POC team have access to `develop--eds-cloud-e1455153--sap.aem.live`? Who grants access? | Client/Adobe | Reusable UDEX code |
| Q2 | Can the events platform be a site under SAP's existing EDS org to share code? | Client | Architecture |
| Q3 | What are the agreed template rules—which templates, which blocks/variants, and which locked areas? | Client (business) | Task 4 |
| Q4 | Who is the block-library designer? What is the Figma handover process? | Client | Design process |
| Q5 | What does "self-serve" include—registration, sign-in, payments, dashboards? | Client | Scope |
| Q6 | Can UDEX be served from a public site? May copies be hosted in the repository? | Client/SAP | Performance |

### Needed Soon

| # | Question | Owner | Blocks |
|---|---|---|---|
| Q7 | Which UDEX version do we start on? **Resolved:** `v2.64.0` | — | — |
| Q8 | Which themes are needed—`sap_glow` only, or also morning, evening, and high-contrast? | Client | Token mapping |
| Q9 | Header/footer—use UDEX Masthead/Footer components or reuse shared `sap.com` fragments? | Client | Templates |
| Q10 | What are the accessibility targets (WCAG level), page-speed targets, analytics requirements, and cookie-consent requirements? | Client | Task 5 |
| Q11 | Does EW in-place editing work with UDEX web components (Shadow DOM)? | Adobe | Task 5 |
| Q12 | Where are the UDEX docs? Getting Started and Changelog appear to be internal. | Client/SAP | All tasks |

### Additional Questions Identified

| # | Question | Owner | Blocks |
|---|---|---|---|
| Q13 | What is the rollback plan if a UDEX version upgrade breaks event pages in production? | Us + Client | Phase 2 |
| Q14 | How should UDEX web-component loading be handled—lazy-load per block or bundle all? | Us | Task 5 |
| Q15 | Who reviews and approves the weekly UDEX upgrade pull request? | Client | Phase 2 |
| Q16 | Are there existing event pages on `events.sap.com` that need migrating? | Client | Scope |
| Q17 | What are the browser-support targets? Do UDEX web components (Shadow DOM) support all required browsers? | Client | Task 5 |
| Q18 | Where do we find the `/admins` and event owner group IDs for the DA permissions sheet? | Adobe/DA admin | Task 3 |

---

## Useful URLs

| Description | URL |
|---|---|
| DA Repo | [https://da.live/#/shubhangigaikar25/eds](https://da.live/#/shubhangigaikar25/eds) |
| Template Page | [https://exercise-demo--eds--shubhangigaikar25.aem.page/templates/udex-page-template](https://exercise-demo--eds--shubhangigaikar25.aem.page/templates/udex-page-template) |
| Test Event Page | [https://exercise-demo--eds--shubhangigaikar25.aem.page/events/test-event/](https://exercise-demo--eds--shubhangigaikar25.aem.page/events/test-event/) |
| UDEX Design Tokens Docs | [https://udextest.z6.web.core.windows.net/v2/index.html](https://udextest.z6.web.core.windows.net/v2/index.html) |
| UDEX CDN Tokens (reference) | [https://cdn.udex.services.sap.com/dds/design-tokens/v2.64.0/themes/sap_glow/css_variables.css](https://cdn.udex.services.sap.com/dds/design-tokens/v2.64.0/themes/sap_glow/css_variables.css) |
| UDEX CDN Fonts (reference) | [https://cdn.udex.services.sap.com/dds/design-tokens/v2.64.0/css/font-face.css](https://cdn.udex.services.sap.com/dds/design-tokens/v2.64.0/css/font-face.css) |
| GitHub Repo | [https://github.com/ShubhangiGaikar25/eds/tree/exercise-demo](https://github.com/ShubhangiGaikar25/eds/tree/exercise-demo) |
| GitHub Actions | [https://github.com/ShubhangiGaikar25/eds/actions](https://github.com/ShubhangiGaikar25/eds/actions) |

---

## Key Learnings (Corrected + Updated)

1. **The block name in HTML must exactly match the folder/file name.** For example, `<div class="card">` → `blocks/card/card.js`. This was the real cause of the block errors, not the function name.
2. **Author Kit calls the default export—whatever it is named.** `init` and `decorate` both work; renaming the function was **not** the fix.
3. **UDEX core tokens use the `--sap...` prefix**—not `--udex...` for fonts and headings.
4. **The font name is `"72 Brand Variable"`**, not `"SAP72"`.
5. **The CDN must be pinned to a fixed version.** Use `v2.64.0` with the `v` prefix. `latest` is risky, and `/2.64.0/` without the `v` returns 404.
6. **Cross-origin CDN stylesheets block first paint**—host UDEX CSS and font files locally in the repo instead of loading from the CDN at runtime.
7. **Font URLs inside `font-face.css` must be rewritten** to local paths after downloading from the CDN.
8. **CSP can be simplified after moving to local hosting**—`'self'` is sufficient; the CDN domain is no longer needed.
9. **GitHub Actions workflows must be on the `main` branch** to be registered and appear in the Actions tab.
10. **Branch-specific preview URLs** use the pattern `https://<branch>--<repo>--<owner>.aem.page`.
11. **The DA config-sheet tab must be named exactly `config`** (lowercase).
12. **Fragments must be previewed and published** before pages that depend on them.
13. **DA org-level config ≠ site-level config.** Collaborator access goes in `.da/config`.
14. **Config sheets do not need to be previewed.** Saving is sufficient.
15. **A UDEX spacer token's number is its pixel value.** `--udexSpacer4` = `4px`, not `1rem`.
16. **The header/footer guard must check `<meta>` tags**, not `.metadata` block `div` elements; EDS converts metadata before scripts run.
17. **The guard must block any value**, not only `off`. Fragment-path swaps such as `header: /other/nav` must also be blocked.
18. **The guard must cover locale prefixes**, including `/de/events/` and `/fr/events/`, using the regex `/^\/([\w-]+\/)?events\//`.
19. **DA has no per-folder config sheets.** All permissions live in one `permissions` sheet in the org config at `da.live/config`.
20. **UDEX has three integration levels:** Tokens (CSS only) → Plain HTML styled as UDEX → Web Components (JavaScript; load only when needed).
21. **Phase 3 auto-rewrite changes must remain human-approved.** Templates are content, not code; automatic rewriting conflicts with governance.
