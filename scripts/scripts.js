import { loadArea, setConfig } from './ak.js';

// Satisfies require-trusted-types-for; runs before loadPage reaches any sink.
if (window.trustedTypes?.createPolicy) {
  window.trustedTypes.createPolicy('default', {
    createHTML: (input) => input,
    createScriptURL: (input) => input,
    createScript: (input) => input,
  });
}

const hostnames = ['authorkit.dev'];

const locales = {
  '': { lang: 'en' },
  '/de': { lang: 'de' },
  '/es': { lang: 'es' },
  '/fr': { lang: 'fr' },
  '/hi': { lang: 'hi' },
  '/ja': { lang: 'ja' },
  '/zh': { lang: 'zh' },
};

const linkBlocks = [
  { fragment: '/fragments/' },
  { schedule: '/schedules/' },
  { youtube: 'https://www.youtube' },
];

// Blocks with self-managed styles
const components = ['fragment', 'schedule'];

// How to decorate an area before loading it
const decorateArea = ({ area = document }) => {
  const eagerLoad = (parent, selector) => {
    const img = parent.querySelector(selector);
    if (!img) return;
    img.removeAttribute('loading');
    img.fetchPriority = 'high';
  };

  eagerLoad(area, 'img');
};

// Guard: prevent event pages from overriding header or footer via metadata
function guardEventPageLayout() {
  const path = window.location.pathname;
  const isEventPage = path.startsWith('/events/');

  if (!isEventPage) return;

  // Find and remove any metadata that tries to override header or footer
  const metaBlocks = document.querySelectorAll('.metadata, .section-metadata');
  metaBlocks.forEach((block) => {
    const rows = block.querySelectorAll(':scope > div');
    rows.forEach((row) => {
      const key = row.children[0]?.textContent?.trim().toLowerCase();
      const value = row.children[1]?.textContent?.trim().toLowerCase();

      // Block header/footer override attempts
      if ((key === 'header' || key === 'footer') && (value === 'off' || value === '')) {
        console.warn(`[Guard] Blocked attempt to set "${key}: ${value}" on event page ${path}`);
        row.remove();
      }
    });
  });
}

export async function loadPage() {
  // Run guard before loading area
  guardEventPageLayout();
  setConfig({ hostnames, locales, linkBlocks, components, decorateArea });
  await loadArea();
}
await loadPage();

(function da() {
  const { searchParams } = new URL(window.location.href);
  const hasPreview = searchParams.has('dapreview');
  if (hasPreview) import('../tools/da/da.js').then((mod) => mod.default(loadPage));
  const hasQE = searchParams.has('quick-edit');
  if (hasQE) import('../tools/quick-edit/quick-edit.js').then((mod) => mod.default());
}());
