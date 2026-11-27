# UDEX on Edge Delivery: Approaches, Decision, Plan and Open Questions

| | |
|---|---|
| **Topic** | 004 · Templates & Design Governance and UDEX Integration |
| **Status** | Draft v1, for team review |
| **Date** | 2026-11-27 |
| **Builds on** | *004 - Templates and Designs Governance POC (v2)*, reviewer notes *Leverage UDEx*, team proposal *Build UDEX files once from Artifactory* (called the **Artifactory build proposal** below) |
| **Platform** | AEM Edge Delivery Services · Document Authoring (DA) · Experience Workspace (EW) · Author Kit |
| **POC site** | DA `shubhangigaikar25/eds` · branch `exercise-demo` (temporary personal repo; moves to SAP later) |

---

## Contents

1. [Goal and client requirements](#1-goal-and-client-requirements)
2. [Where the POC stands today](#2-where-the-poc-stands-today)
3. [UDEX facts (verified)](#3-udex-facts-verified)
4. [Approaches considered](#4-approaches-considered)
5. [Decision: the approach we use](#5-decision-the-approach-we-use)
6. [Target architecture](#6-target-architecture)
7. [Governance enforced in code and config](#7-governance-enforced-in-code-and-config)
8. [Upgrade process](#8-upgrade-process)
9. [Implementation plan](#9-implementation-plan)
10. [Requirements and working assumptions](#10-requirements-and-working-assumptions)
11. [Blockers and risks](#11-blockers-and-risks)
12. [Questions for the client](#12-questions-for-the-client)
13. [Decisions we make ourselves / things we test ourselves](#13-decisions-we-make-ourselves--things-we-test-ourselves)
14. [Corrections needed in the 004 document](#14-corrections-needed-in-the-004-document)
15. [References](#15-references)

---

## 1. Goal and client requirements

**Goal:** prove that event pages on Edge Delivery can use the SAP UDEX design system, stay in step with UDEX releases under human control, and stop event owners from changing the design.

**Client requirements (2026-11-12 and follow-up answers):**

| # | Requirement | Source |
|---|---|---|
| R1 | All standard templates follow the SAP brand: one theme, many events | Client |
| R2 | Templates use UDEX as the design reference | Client |
| R3 | Owners pick a template and change **content and images only**, not colours, fonts or layout | Client |
| R4 | Header and footer are locked; more locked areas will follow from business rules | Client |
| R5 | Heroes and other images may differ per event | Client |
| R6 | The block-library owner is a designer (to be named), with a process like sap.com's | Client |
| R7 | Template designs and governance still need to be agreed with the business | Client |
| R8 | Spam and bot protection on the registration endpoint aligns with ORCA (Michael Langford's workstream) | Client |
| R9 | If registration is ever down, the page explains why | Client |
| R10 | Design changes stay human-approved; templates are content and are never rewritten automatically | Reviewer |

### Client answers received so far

| Topic | Answer | Status | Follow-up |
|---|---|---|---|
| Spam and bot protection | Align with ORCA (Michael Langford) | Redirected | Meet Michael. Move to topic 08 (registration) |
| Registration down | Should never be down; if it is, explain why | Partial | Which states, who writes the messages, is there a status API (Q-H2) |
| Templates per tier, what owners can change | Align with business; leverage UDEX | Open | Q-C1, Q-C2 |
| One theme or per series, who approves | One SAP brand theme; images may differ | Mostly | Flagship events (Q-C3) |
| Block-library owner | Designer TBD, like sap.com | Partial | Name and date (Q-C4) |
| Blocking vs warning checks | Align with business, see wiki | Open | Send proposal (Q-C6) |
| Accessibility target | No answer | Open | Send proposal (Q-D1) |

---

## 2. Where the POC stands today

| Item | Status |
|---|---|
| UDEX tokens mapped in `styles.css` (colours, type, spacing, radius, shadows) | Done |
| UDEX pinned to `v2.64.0`, files hosted in the repo (no CDN at runtime) | Done |
| CSP reduced to `'self'` | Done |
| UDEX-aligned template page (`templates/udex-page-template`) | Done |
| Block fixes (block name must match folder name) | Done |
| Header/footer guard (any value, locale prefixes) | Done, needs the change in 7.1 |
| Weekly UDEX version check that opens a PR with a token diff | Done, needs the changes in section 8 |
| Section colour and layout limits on event pages | **Not started** (biggest governance gap) |
| Block/variant allowlist per template | Not started (needs agreed templates) |
| DA permissions sheet in the org config | Not started (needs groups) |
| Layer 2 blocks styled as UDEX | Not started |
| Layer 3 UDEX web components | Not started |
| Event template set (landing, agenda, speakers, ...) | Draft from the SAP webinar page; rest pending |

**Known issues in the current setup:**

1. The full token file (1,197 tokens) and the font stylesheet load in `head.html` and block the first paint.
2. The weekly workflow commits and pushes to the checked-out branch, which is `main` on scheduled runs. That skips human review.
3. The token diff compares names only, so value changes (for example, the brand blue) are missed.
4. The guard regex `^\/([\w-]+\/)?events\//` treats any first folder as a locale (`/drafts/events/` matches).
5. Section metadata accepts any colour or layout (`background: hotpink` works).

---

## 3. UDEX facts (verified)

Checked on 2026-11-26/27 against the UDEX documentation site and the published packages.

### 3.1 Which UDEX source we use for what

| Source | What it is | We use it for |
|---|---|---|
| **UDEX documentation site** (Storybook, `udextest.z6.web.core.windows.net/v2`) | The UDEX team's docs: Getting Started (Design Tokens, Web Components, UDEx CDN), live component demos with attributes and CSS variables, Theming, Accessibility Testing, Patterns, Floorplans, Migration guides, Governance, and the **changelog up to v2.64.0** | **Primary reference** for designers and developers: what each component looks like, its options, its accessibility notes, and what changed in each version |
| **UDEX packages** (`@sapudex/web-components`, `@sapudex/design-tokens` on npm / Artifactory) | The actual files UDEX publishes | **Build source**: the only place to get the exact files at a fixed version, check dependencies and licence, and measure sizes. Also lets the weekly job detect new versions |
| **UDEX CDN** | Hosted token, font and theme files | Reference only. Not loaded at runtime (we self-host) |

The docs show *how to use* UDEX; the packages are *what we ship*. The docs site is hosted on a "test" address, so confirm with the UDEX team that it's the official, stable documentation (Q-B6).

### 3.2 Facts

| Fact | Detail |
|---|---|
| Packages | `@sapudex/web-components` 2.64.0 and `@sapudex/design-tokens` 2.64.0 (public npm). The Artifactory build proposal names `@udex/design-tokens`: confirm the name on Artifactory |
| Documentation | Public docs site with 559 entries, including a per-version changelog (v2.0.0 → v2.64.0) and migration guides |
| Licence | **None stated** on npm |
| UI5 dependencies | Bundled as regular dependencies, pinned to 2.28.1 (`@ui5/webcomponents`, `-base`, `-fiori`, `-icons`, `-theming`, `-localization`), plus `video.js` and `@vimeo/player` |
| Themes in the token package | `sap_glow`, `sap_glow-morning`, `sap_glow-evening`, `sap_glow-hcb`, `sap_glow-hcw` |
| Can't be loaded as-is | Components import UI5 by package name (bare imports). Browsers can't resolve these and EDS has no build step, so the files must be **pre-bundled** |
| API documentation | On the docs site (live demos, attributes, CSS variables). As a backup, every component in the package ships a documented type file (`dist/*.d.ts`) with tag name, attributes and defaults, e.g. `udex-date-picker` |
| Theme activation | `<script data-ui5-config type="application/json">{"theme":"sap_glow"}</script>` |
| Language | English built in; other languages are fetched on demand. Custom texts via `window["udex-config"].translations` |
| Coexistence with other UI5 code | Supports a scoping suffix for tag names (avoids clashes with sap.com's UI5 version) |

**Components relevant to events:** HeroBanner, Accordion, PromoTile, Tile, Contact, Quote, EventRibbon, MediaPlayer (YouTube/Vimeo), MastheadShell and Masthead items/menus, Footer, DatePicker, Wizard, TextField, Checkbox, PhoneNumberField, Upload, Search, FilterMenu, Modal, Toast, Pagination, Breadcrumbs.

### Measured bundle sizes (approximate, JavaScript only, excluding theme/language files)

| Bundle | Raw | Compressed |
|---|---|---|
| HeroBanner (split build) | ~257 KB | ~54 KB |
| Accordion (split build) | ~352 KB | ~69 KB |
| MediaPlayer (split build) | ~343 KB | ~75 KB |
| DatePicker (split build) | ~578 KB | ~127 KB |
| Masthead, 7 components, single file | ~750 KB | ~147 KB |
| Masthead + `Assets.js`, single file (all languages inlined) | ~15 MB | **~2.7 MB** |

**What this means:**
- Even the simplest component carries the UI5 runtime (~50 KB compressed). Content blocks must not use web components.
- A "single file with everything inlined" build that includes `Assets.js` is larger than sap.com's own 1.2 MB masthead. Use a split build.
- The full masthead is about 60% of sap.com's 1.2 MB, not "a small fraction". Trim it by leaving out parts event pages don't need.

---

## 4. Approaches considered

| # | Approach | Pros | Cons | Verdict |
|---|---|---|---|---|
| A | **Three layers:** tokens everywhere, UDEX-styled plain HTML for content blocks, pre-bundled UDEX components loaded lazily in interactive blocks | Fast pages, good for search, editable in EW, real UDEX where interaction matters | We maintain the UDEX look in Layer 2 blocks | **Basis of the decision** |
| B | UDEX web components for everything, hero included | Closest to UDEX; look updates with each version | ~54 KB+ before the first content shows, lower page speed, editing risk, content depends on JavaScript | Rejected |
| C | Tokens only, no web components | Simplest and fastest; no component licence question | We build and test date picker, wizard and forms ourselves; they drift from UDEX | **Fallback** if Layer 3 fails or the licence answer is "no" |
| D | Load tokens/components from the UDEX CDN | Avoids the "may we host copies" question | Cross-origin files slow the first paint; outside dependency; unclear if the CDN serves components | **Fallback** if SAP says "no copies in the repo" |
| E | Reuse sap.com's EDS implementation (`develop--eds-cloud-e1455153--sap.aem.live`) | Already solves loading, upgrades and editing ("shadowless" mode); consistent with sap.com | Needs access (Q-A3); ties us to sap.com's release cycle | **Preferred for production** if access is granted |
| F | Serve the package files unbundled with an import map | No build step | Over 2,000 files; hundreds of requests per page | Rejected |
| G | **Artifactory build proposal:** build once from Artifactory, commit the output, serve from the site, masthead first | Same principle as A's Layer 3, with better token/font loading, a clean build folder and a concrete first component | Single-file build, boilerplate-specific code, Artifactory vs weekly CI, see 5.2 | **Adopted, with the fixes in 5.2** |

**Options the Artifactory build proposal rejects (agreed):**
- Downloading sap.com's compiled files (`shareable-Masthead.js`, `vendor-ui5.js`): no version, unclear licence, sap.com-specific glue code, 1.2 MB, renamed every release. Only for a throwaway demo, with the sap.com team's permission.
- Loading from App Builder or another external URL: runtime dependency, CORS issues, files hosted elsewhere.
- Loading the masthead in `head.html`: blocks rendering.

---

## 5. Decision: the approach we use

### 5.1 Summary

**Approach A, implemented with the build-and-commit setup from the Artifactory build proposal (G), with five fixes.**

- **Layer 1, tokens:** every block uses UDEX tokens through the project's own CSS variables. Only first-screen tokens are in `styles.css`; the full token file loads after the first paint.
- **Layer 2, UDEX-styled blocks:** hero, columns, cards, speakers, agenda and teasers output plain HTML that looks like UDEX. No UDEX JavaScript.
- **Layer 3, UDEX web components:** built once per UDEX version from the packages, committed as plain static files, loaded only by the block that needs them, never in the first section.
- **First Layer 3 deliverable:** the masthead (header). It's visible, reused on every page, and loads after the main content.
- **Upgrades:** pinned versions, upgraded on purpose through a reviewed PR.

### 5.2 Fixes to the Artifactory build proposal

| # | Issue | Fix |
|---|---|---|
| F1 | `inlineDynamicImports: true` with `Assets.js` gives a ~2.7 MB file; without `Assets.js`, German built-in texts are missing | **Split build** (output folder with shared chunks). Only the language a page needs is downloaded, and later components share the UI5 runtime |
| F2 | Size target "a small fraction of 1.2 MB" is not realistic for the full masthead (~750 KB raw / ~147 KB compressed) | Set the budget from the smoke test. Leave out profile menu / country selector if event pages don't need them |
| F3 | Code samples use the standard boilerplate (`scripts/aem.js`, `loadCSS`, `window.hlx.codeBasePath`); the POC uses Author Kit | Adapt to Author Kit's helpers. Confirm when Author Kit loads the header |
| F4 | Artifactory may be unreachable from GitHub Actions; the weekly check depends on it | Weekly job detects versions (public npm or Artifactory) and opens a PR/issue with the token diff; the build runs where Artifactory is reachable (see section 8) |
| F5 | "Make the repo private" doesn't make the served files private | Treat the licence approval as mandatory before anything is public (Q-B1) |

---

## 6. Target architecture

### 6.1 The three flows

```text
A. Visitor views a page
Visitor ──► Edge Delivery ──► page HTML (from DA)
                            ├► styles.css (first-screen tokens) + fonts.css
                            ├► block JS/CSS (Layer 2)
                            ├► full UDEX token file (after first paint)
                            └► UDEX component bundles (only in blocks that need them)

B. Event owner edits
Event owner ──► Experience Workspace / DA ──► preview / publish ──► Edge Delivery
                  (renders with the current main code = current UDEX version)

C. UDEX releases a new version
UDEX team ──► npm / Artifactory
Weekly job ──► new version? ──► token diff (names + values) ──► PR or issue
Build (where Artifactory is reachable) ──► rebuilt bundles + tokens on the PR branch
Review on branch preview (dev + designer) ──► merge ──► every event page uses the new version
Rollback = revert the PR (no content republishing)
```

### 6.2 Repository layout

```text
tools/udex/                          ← build only; never served (.hlxignore) and not linted
  package.json                       ← exact versions of both UDEX packages
  package-lock.json
  .npmrc                             ← registry + ${ARTIFACTORY_TOKEN} (token never stored)
  src/udex-config.js                 ← Assets.js + setTheme/setLanguage exports
  src/udex-masthead.js               ← masthead components only
  src/udex-<component>.js            ← one entry per later component (date picker, wizard, media player)
  rollup.config.mjs                  ← split build, version banner comment, no source maps
  README.md                          ← how to rebuild

scripts/vendor/udex/v2.64.0/         ← build output, committed
  udex-config.js
  udex-masthead.js
  chunks/*.js                        ← shared UI5 runtime, language and theme files
scripts/udex.js                      ← small loader used by blocks
styles/udex/v2.64.0/css_variables.css   ← full sap_glow tokens (existing path)
styles/fonts/udex/72BrandVariable_Th-Blk.woff2  ← 72 font (existing path)
```

Versioned folders give cache-busting and simple rollback. Keep the existing token and font paths to avoid churn.

### 6.3 Build (split, not inlined)

```js
// tools/udex/rollup.config.mjs (sketch)
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import pkg from '@sapudex/web-components/package.json' with { type: 'json' };

const VERSION = `v${pkg.version}`;

export default {
  input: {
    'udex-config': 'src/udex-config.js',
    'udex-masthead': 'src/udex-masthead.js',
    // 'udex-date-picker': 'src/udex-date-picker.js',
  },
  output: {
    dir: `../../scripts/vendor/udex/${VERSION}`,
    format: 'es',
    entryFileNames: '[name].js',
    chunkFileNames: 'chunks/[name]-[hash].js',
    banner: `/* @sapudex/web-components ${pkg.version} */`,
  },
  plugins: [resolve(), json(), terser()],
};
```

```js
// tools/udex/src/udex-config.js
import '@sapudex/web-components/dist/Assets.js'; // themes + languages, fetched on demand
export { setTheme } from '@ui5/webcomponents-base/dist/config/Theme.js';
export { setLanguage } from '@ui5/webcomponents-base/dist/config/Language.js';
```

The build script also copies `css_variables.css` (sap_glow) and the 72 font into the project. Check the real file names in the package before writing it.

### 6.4 How each file loads

| File | How it loads | Why |
|---|---|---|
| `head.html` | `<script data-ui5-config type="application/json">{ "theme": "sap_glow" }</script>` only | Tiny; blocks nothing |
| `styles/styles.css` | First-screen tokens only; project variables point at UDEX values | Fast first screen |
| `styles/fonts.css` | `@font-face` for 72 with `font-display: swap` and a size-matched fallback | No invisible text, no layout jump |
| `css_variables.css` (full tokens) | Loaded after the first paint (lazy styles or from the header block) | Not needed for the first screen |
| `udex-config.js` + component bundles | Dynamic `import()` from `scripts/udex.js`, called only by blocks that need them | No cost on pages without them |

### 6.5 Loader

```js
// scripts/udex.js
const UDEX_VERSION = 'v2.64.0';
const BASE = `/scripts/vendor/udex/${UDEX_VERSION}`; // adapt to Author Kit's code base path

let ready;

export async function loadUdex(name) {
  ready ??= import(`${BASE}/udex-config.js`).then(({ setTheme, setLanguage }) => {
    setTheme('sap_glow');
    setLanguage(document.documentElement.lang || 'en');
  });
  await ready;
  return import(`${BASE}/${name}.js`);
}
```

### 6.6 Header block builds the masthead (Layer 3)

```js
// blocks/header/header.js (sketch; replace DOM helpers with Author Kit's)
import { loadUdex } from '../../scripts/udex.js';

const meta = (name) => document.head.querySelector(`meta[name="${name}"]`)?.content;

export default async function init(block) {
  await loadUdex('udex-masthead');
  const shell = document.createElement('udex-masthead-shell');
  shell.setAttribute('home-url', 'https://www.sap.com/index.html');
  shell.setAttribute('logo-url', '/icons/sap-logo.svg');
  shell.setAttribute('logo-alt', 'SAP');

  // event-branded masthead (e.g. "SAP NOW AI Tour"), set per event in page metadata
  const label = meta('event-name');
  if (label) {
    shell.setAttribute('site-label', label);
    shell.setAttribute('site-label-url', meta('event-url') || window.location.pathname);
  }

  // build udex-masthead-item and mobile menu children from the nav fragment here
  block.replaceChildren(shell);
}
```

Add `udex-masthead-shell:not(:defined) { min-height: <masthead height>; }` so the page doesn't jump while the components load. Check attribute names on the docs site (*Components → Navigation → Masthead*) and in `MastheadShell.d.ts`.

**SAP services (runtime data):** login state (SAP SSO), search and the country list come from SAP services that `header.js` calls. See Q-H3.

### 6.7 Initial block-to-UDEX mapping

| Event block | Layer | UDEX reference |
|---|---|---|
| Header | 3 | MastheadShell + items (Q-B3) |
| Footer | 2 or 3 | Footer (Q-B3) |
| Hero | 2 | Styled after HeroBanner |
| Intro / columns | 2 | — |
| Speakers (card) | 2 | Styled after Tile / Contact |
| Agenda (accordion) | 2 | Styled after Accordion, native `<details>` |
| Event date/location strip | 2 | Styled after EventRibbon |
| Video | 2 + 3 | Poster image + play button; MediaPlayer loads on click |
| Registration form | 3 | Wizard, TextField, Checkbox, DatePicker (topic 08) |
| Event search / filters | 3 | Search, FilterMenu |

Rule: content → Layer 2, interactive → Layer 3, and the first section never waits for a web component.

---

## 7. Governance enforced in code and config

### 7.1 Header/footer guard

Remove `header`/`footer` metadata **whatever its value** on event paths, using the locales from Author Kit's config instead of "any first folder":

```js
const LOCKED_META = ['header', 'footer'];

function guardEventPageLayout(locales) {
  const prefixes = Object.keys(locales).filter(Boolean).join('|');
  const eventPath = new RegExp(`^(?:${prefixes})?/events/`);
  if (!eventPath.test(window.location.pathname)) return;
  LOCKED_META.forEach((name) => {
    document.querySelectorAll(`meta[name="${name}"]`).forEach((m) => {
      console.warn(`[Guard] Ignored "${name}: ${m.content}" on event page`);
      m.remove();
    });
  });
}
```

`event-name` / `event-url` stay allowed: owners may label the masthead, but not replace it (confirm with Q-C2).

### 7.2 Section colours and layout

On event pages, accept only an approved list of UDEX colour tokens and layouts in section metadata, and ignore everything else (`background: hotpink`, custom grids, gaps, spacing). The list comes from the designer (Q-C2, Q-C4).

### 7.3 Blocks and variants per template

Allowlist of blocks and variants per template, enforced in code and in publish checks, once templates are agreed (Q-C1). The DA Library lists only approved blocks; the `library` folder is admin-only.

### 7.4 DA permissions (org config `permissions` sheet)

| path | groups | actions |
|---|---|---|
| `/<site>/fragments/**` | `<org-id>/admins` | write |
| `/<site>/templates/**` | `<org-id>/admins` | write |
| `/<site>/library/**` | `<org-id>/admins` | write |
| `/<site>/schedules/**` | `<org-id>/admins` | write |
| `/<site>/events/**` | event owners group | write |
| `CONFIG` | `<org-id>/admins` | write |

### 7.5 Publishing checks (proposal to the client)

| Check | Proposed |
|---|---|
| Missing SEO title or description | Block |
| H1 count is not exactly 1 | Block |
| Placeholder or lorem ipsum text | Block |
| Registration link missing or invalid (registration templates) | Block |
| Image without alt text | Block |
| Block, variant or section style not allowed for the template | Block |
| Header/footer override in metadata | Block (also enforced in code) |
| Broken internal link | Block |
| Broken external link | Warn |
| Skipped heading levels | Warn |
| Oversized images | Warn |
| Missing social image | Warn |
| Event date in the past | Warn |

Checks in the preview tools only warn. "Block" is enforced by limiting **publish** rights to approvers in the site configuration (owners preview, approvers publish), or by a custom check.

---

## 8. Upgrade process

| Step | What | Who |
|---|---|---|
| 1 | Weekly job checks for a new version of both packages (they must match) | GitHub Actions |
| 2 | Token diff: added, removed **and changed values**; fail if a removed token is used in `styles.css` or blocks | GitHub Actions |
| 3 | Opens a PR (or issue) on a new branch, linking the version's changelog and migration notes on the UDEX docs site. **Never pushes to `main`** | GitHub Actions |
| 4 | Rebuild bundles and tokens (`npm run build` in `tools/udex/`) and commit to the PR branch | CI if Artifactory is reachable, otherwise a developer with access |
| 5 | Review on the PR's branch preview (`udex-vX--<repo>--<owner>.aem.page`) | Developer + designer |
| 6 | Merge; rollback = revert the PR | Approver (Q-C5) |

Upgrade when the design changes, for security fixes, and periodically to stay in step with sap.com. No upgrades during freeze periods before major events (Q-E5).

---

## 9. Implementation plan

| # | Step | Depends on | Done when |
|---|---|---|---|
| 0 | **Smoke test:** bundle one component (DatePicker), render it on a test event page with `sap_glow` and German | — | It renders and works; go/no-go for Layer 3 |
| 1 | Set up `tools/udex/` (package.json, lockfile, `.npmrc`, split rollup build, README) and add it to `.hlxignore` | Step 0 | `npm run build` writes `scripts/vendor/udex/v2.64.0/` |
| 2 | Move token and font loading: first-screen tokens in `styles.css`, full file after first paint, font via `fonts.css` | — | Nothing UDEX-related blocks the first paint |
| 3 | Fix the header/footer guard to use the configured locales | — | `/de/events/...` blocked; `/drafts/events/...` not treated as an event page |
| 4 | Masthead header block (Layer 3) from the nav fragment, with event label from metadata | Steps 1, 2 | Global and event-branded masthead both work; no layout jump |
| 5 | Layer 2 blocks: hero, columns, card (speakers), accordion (agenda) styled as UDEX | Step 2 | SAP webinar page rebuilt with no UDEX JavaScript in the first section |
| 6 | Video block: poster + MediaPlayer on click | Step 1 | Plays on the test page; no cost until clicked |
| 7 | Section colour/layout guard on event pages | Draft list from designer | `background: hotpink` and unapproved grids are ignored |
| 8 | Fix the weekly job (section 8) | Q-A5 | A simulated version bump produces a correct PR, no push to `main` |
| 9 | DA permissions sheet | Q-E1 | Owner can edit `/events/**`, not `/fragments/**` or `/library/**` |
| 10 | Measure: page speed with/without Layer 3; EW in-place editing with UDEX components | Steps 4–6 | Results documented; Layer 2/3 split confirmed |
| 11 | Block-to-UDEX mapping table and event template set (landing first) | Q-C1, Q-C4 | Agreed with the designer and business |

---

## 10. Requirements and working assumptions

Unless the client says otherwise:

| Area | Assumption |
|---|---|
| UDEX version | `v2.64.0`, both packages on the same version |
| Theme | `sap_glow` only; high-contrast later |
| Browsers | Current versions of Chrome, Edge, Safari, Firefox |
| Page speed | Lighthouse 90+ on mobile for event pages |
| Accessibility | WCAG 2.2 AA |
| POC languages | English and German (`/de/events/`) |
| Rollback | Revert the PR |
| Component loading | Per block, lazily; never in the first section |
| Header/footer | UDEX masthead/footer built from locked fragments |
| Registration | Out of POC scope; a button links to ORCA |
| Cookie consent and analytics | Production only |
| Repo | Personal GitHub repo for the POC; moves to SAP before production |

---

## 11. Blockers and risks

| # | Item | Type | Blocks POC? | Mitigation |
|---|---|---|---|---|
| B1 | UDEX and 72 font licence not stated (Q-B1) | Legal | No (preview only); **yes for go-live** | Written approval before anything is public |
| B2 | UDEX components not yet run in a browser in our setup | Technical | Until step 0 | Smoke test first; fallback approach C |
| B3 | Artifactory access and whether CI can reach it (Q-A5) | Access | Partly (build step) | Public npm for the POC; manual build fallback |
| B4 | Shadow DOM vs EW in-place editing (Q11) | Technical | No | Layer 2 for content; test in step 10; sap.com's shadowless mode (Q-A3) |
| B5 | Bundle size hurts page speed | Performance | No | Split build, lazy loading, trimmed masthead |
| B6 | No designer or approved designs yet (Q-C4) | Process | Partly (fidelity) | Match UDEX look from components; sign-off later |
| B7 | Templates not agreed (Q-C1) | Business | No | Use the webinar page as the stand-in landing template |
| B8 | SAP service endpoints for the masthead (Q-H3) | Integration | For step 4 data only | Static nav first; services later |
| B9 | DA groups not defined (Q-E1) | Access | For step 9 | Test with named users |
| B10 | Personal repo and DA org must move to SAP | Platform | No | Keep a list of every place the account name appears (library URLs, preview URLs, CI) |

---

## 12. Questions for the client

Each question has a proposal, so the client can confirm or correct. If there's no answer by the agreed date, we proceed with the proposal.

### A. POC scope and platform (product owner, SAP web team)

| # | Question | Our proposal |
|---|---|---|
| Q-A1 | What must the POC prove, and who sees the demo, when? | 1) Owners change content and images only. 2) UDEX applied and upgraded through a reviewed change. 3) One interactive UDEX component works and the page stays fast |
| Q-A2 | Is registration in this POC? | No; a button links to ORCA |
| Q-A3 | Is there SAP code we're **expected** to reuse (sap.com EDS, shadowless mode, `/sapudex-version-update` and its upgrade wiki)? If yes, who grants access? | Build our own for the POC; align with sap.com before production |
| Q-A4 | Can the events platform be a site under SAP's EDS org, sharing code with sap.com? | Decide before production |
| Q-A5 | Must UDEX come from Artifactory? Can GitHub Actions reach it? Who has access? | Public npm for the POC; Artifactory for production |

### B. Brand and UDEX (UDEX team, SAP brand)

| # | Question | Our proposal |
|---|---|---|
| Q-B1 | May we commit compiled UDEX output and self-host the 72 font on a public site? (no licence on npm) | Self-hosting, as in the POC |
| Q-B2 | Which UDEX components should event blocks look like? Is there a UDEX Figma library and a designer contact? | Map hero, cards, FAQ, teasers to the nearest UDEX components |
| Q-B3 | Header/footer: UDEX Masthead/Footer, or sap.com's shared ones? | UDEX masthead built from our fragments |
| Q-B4 | `sap_glow` only? | Yes; high-contrast later |
| Q-B5 | Must web-components and design-tokens always be on the same version? How are UI5 dependency upgrades handled? | Same version, upgraded together |
| Q-B6 | Is the docs site at `udextest.z6.web.core.windows.net/v2` the official, stable UDEX documentation, or is there a production address? | Use it as the primary reference meanwhile |

### C. Templates and governance (business, designer)

| # | Question | Our proposal |
|---|---|---|
| Q-C1 | Which templates for the POC, with which required/optional sections and allowed blocks? | Landing, agenda, speakers; landing based on the SAP webinar page |
| Q-C2 | Owners change text, images and links only. Anything else allowed (e.g. event label in the masthead, choice of 2–3 hero styles)? | Event label yes; hero style choice optional |
| Q-C3 | Do flagship events (Sapphire, TechEd) follow the same single theme? | If not, out of POC scope |
| Q-C4 | Who is the block-library designer, and what is the handover (Figma)? Which section colours and layouts are approved? | Interim: we propose a list for sign-off |
| Q-C5 | Who approves changes that reach all events at once (block code, UDEX upgrades)? | Dev lead + designer |
| Q-C6 | Which publishing checks block and which warn? | Table in 7.5 |
| Q-C7 | Can event owners publish themselves, or does an approver publish? | Owners preview, approvers publish |
| Q-C8 | Should event images come from DA or from AEM Assets / Dynamic Media? | DA for the POC |

### D. Compliance (business, legal)

| # | Question | Our proposal |
|---|---|---|
| Q-D1 | Accessibility target, which laws apply (EU Accessibility Act / EN 301 549, ADA, Section 508), who signs off? | WCAG 2.2 AA |
| Q-D2 | Cookie consent and analytics: which tools, and are they needed in the POC? | Production only |

### E. Access and operations (DA admin, SAP IT)

| # | Question | Our proposal |
|---|---|---|
| Q-E1 | Who creates the admin and event-owner groups for DA permissions? | Named users for the POC |
| Q-E2 | Where should the repo live (SAP GitHub / GitHub Enterprise)? Rules for CI secrets and bot accounts? | Personal repo for the POC |
| Q-E3 | Code Sync app or Cloud Manager for deployment? | Code Sync app |
| Q-E4 | Where should change notifications go (Teams, email)? | Teams channel |
| Q-E5 | Are there freeze periods before major events (no code or UDEX releases)? | Two weeks before flagship events |

### F. Localization

| # | Question | Our proposal |
|---|---|---|
| Q-F1 | Which locales at launch? Is `/{locale}/events/` the URL pattern? | `en`, `de` for the POC |
| Q-F2 | Translation workflow (DA translation or an external system)? Right-to-left languages? | Later |
| Q-F3 | Who owns locale formatting (e.g. "13:00 Uhr" vs "1:00 PM")? | Locale conventions per page |

### G. Non-functional

| # | Question | Our proposal |
|---|---|---|
| Q-G1 | Page-speed target and page-weight budget? | Lighthouse 90+ mobile |
| Q-G2 | Browser support? | Current evergreen browsers |

### H. Registration and SAP services (topic 08)

| # | Question | Our proposal |
|---|---|---|
| Q-H1 | What does "self-serve" include (event creation, registration, SAP ID sign-in, payments, dashboards)? | Anything app-like needs back-end APIs; Edge Delivery provides none |
| Q-H2 | Registration states to design for (closed, sold out, waitlist, maintenance, error)? Does ORCA expose a status? Who writes the messages? | Messages as authorable content |
| Q-H3 | Masthead services: SSO login state, search, country list. Endpoints? CORS for the events domain? Is the SSO session visible there? What shows if a service is down? | Static masthead first; services later |
| Q-H4 | Bot protection on the ORCA endpoint (via Michael Langford): does the page need a widget or token? | Follow ORCA |

### Before production (not POC)

Migration of existing events.sap.com pages and redirects; past-event archive; analytics stack; translation workflow; upgrade approval at scale; final repo and DA org.

---

## 13. Decisions we make ourselves / things we test ourselves

| Item | Type | Answer |
|---|---|---|
| UDEX start version | Decision | `v2.64.0` |
| Rollback | Decision | Revert the PR |
| Component loading | Decision | Per block, lazily, split build |
| Bundler | Decision | Rollup (split output) |
| In-place editing with UDEX components (Q11) | Test | Step 10 |
| Bundle size and page speed | Test | Steps 0 and 10 |
| Browser behaviour of UDEX components | Test | Step 0 |

---

## 14. Corrections needed in the 004 document

1. Section 1.7 and learning 13 still say collaborator access goes in `.da/config`. Permissions live in the org config `permissions` sheet.
2. Permissions paths `//fragments/**` → `/<site>/fragments/**`, and add the `CONFIG` row.
3. The weekly workflow commits and pushes to the checked-out branch; change to "branch + PR only".
4. Testing "on exercise-demo branch" → test on the PR's own branch preview.
5. Q7 is half resolved: version agreed, "who owns upgrades" still open (Q-C5).
6. The "UDEX Design Tokens Docs" link is the UDEX docs site (hosted on a test address). Keep it as the main reference, but rename it "UDEX documentation" and note that its official status is being confirmed (Q-B6).
7. Track `@sapudex/web-components` as well as the token package.
8. Remove the unused Montserrat font setup.
9. Add: section colour/layout guard, block-to-UDEX mapping table, the three flows, and "the first section never waits for a web component".

---

## 15. References

| Description | URL |
|---|---|
| DA repo (POC) | https://da.live/#/shubhangigaikar25/eds |
| Template page (POC) | https://exercise-demo--eds--shubhangigaikar25.aem.page/templates/udex-page-template |
| Test event page (POC) | https://exercise-demo--eds--shubhangigaikar25.aem.page/events/test-event/ |
| GitHub repo (POC) | https://github.com/ShubhangiGaikar25/eds/tree/exercise-demo |
| SAP webinar reference page | https://testwebinars.dm.ux.sap.com/translation/de_de/home.html |
| **UDEX documentation (primary reference)** | https://udextest.z6.web.core.windows.net/v2/index.html?path=/docs/about-introduction--docs |
| UDEX changelog (latest) | Docs site → *Documentation → Changelog → Version 2 → Latest* |
| UDEX Getting Started (tokens, web components, CDN) | Docs site → *Documentation → Getting Started* |
| UDEX tokens on CDN (reference only) | https://cdn.udex.services.sap.com/dds/design-tokens/v2.64.0/themes/sap_glow/css_variables.css |
| UDEX web components package (build source, version check) | https://www.npmjs.com/package/@sapudex/web-components |
| UDEX design tokens package (build source, version check) | https://www.npmjs.com/package/@sapudex/design-tokens |
| DA permissions | https://www.aem.live/docs/ew/administering/permissions |
| DA library setup | https://www.aem.live/docs/ew/administering/set-up-library |
| EDS performance guidance | https://www.aem.live/developer/keeping-it-100 |
