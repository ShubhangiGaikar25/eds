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
// Runs immediately before EDS processes meta tags
function guardEventPageLayout() {
  const path = window.location.pathname;
  const isEventPage = path.startsWith('/events/');

  if (!isEventPage) return;

  // Remove any meta tags trying to override header or footer
  const metaTags = document.querySelectorAll('meta[name="header"], meta[name="footer"]');
  metaTags.forEach((meta) => {
    const name = meta.getAttribute('name');
    const value = meta.getAttribute('content')?.trim().toLowerCase();

    if (value === 'off' || value === '') {
      console.warn(`[Guard] Blocked attempt to set "${name}: ${value}" on event page ${path}`);
      meta.remove();
    }
  });
}

// Run guard immediately before EDS processes meta tags
guardEventPageLayout();

export async function loadPage() {
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
