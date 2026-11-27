import { getConfig, loadStyle } from '../../scripts/ak.js';
import { loadFragment } from '../fragment/fragment.js';

const HOME_URL = 'https://www.sap.com';
const LOGO_TEXT = 'SAP';

const titleCase = (id) => id
  .split('-')
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

/**
 * Builds the logo link from the authored "header" page.
 * Falls back to a text link if the logo image is missing or failed to upload.
 */
function buildBrand(content) {
  const img = content.querySelector('img');
  const authoredLink = img?.closest('a');
  const brand = document.createElement('a');
  brand.className = 'event-header-brand';
  brand.href = authoredLink?.href || HOME_URL;

  const broken = !img || img.getAttribute('src') === 'about:error';
  if (broken) {
    brand.textContent = LOGO_TEXT;
    return brand;
  }
  img.loading = 'eager';
  if (!img.alt) img.alt = LOGO_TEXT;
  brand.append(img.closest('picture') || img);
  return brand;
}

/**
 * Builds the jump links from the sections of the current page that have an id
 * (set with section-metadata "id"). Pages without such sections get no links.
 */
function buildJumpNav() {
  const sections = [...document.querySelectorAll('main > div[id]')];
  if (!sections.length) return null;

  const nav = document.createElement('nav');
  nav.className = 'event-header-nav';
  nav.setAttribute('aria-label', 'Event sections');
  const list = document.createElement('ul');

  const links = sections.map((section) => {
    // Headings get automatic ids; drop one that repeats its section's id (ids must be unique)
    section.querySelector(`[id="${section.id}"]`)?.removeAttribute('id');

    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${section.id}`;
    a.textContent = section.dataset.navLabel || titleCase(section.id);
    li.append(a);
    list.append(li);
    return { a, section };
  });
  nav.append(list);

  // Mark the section currently in view
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach(({ a, section }) => {
        if (section === entry.target) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach(({ section }) => observer.observe(section));

  return nav;
}

/**
 * Event header: SAP logo, jump links, Register now.
 * Content comes from the "header" page in the event's own folder,
 * so it can't be swapped through page metadata.
 * @param {Element} el The <header> element
 * @param {string} eventRoot The event folder, e.g. "/blueprints/hr-connect/"
 */
export default async function decorateEventHeader(el, eventRoot) {
  const { codeBase } = getConfig();
  const style = loadStyle(`${codeBase}/blocks/header/event-header.css`);
  document.body.classList.add('event-page');

  const content = await loadFragment(`${eventRoot}header`);
  const register = content.querySelector('a.btn') || content.querySelector('strong a');

  const bar = document.createElement('div');
  bar.className = 'event-header';
  bar.append(buildBrand(content));

  const nav = buildJumpNav();
  if (nav) bar.append(nav);

  if (register) {
    const actions = document.createElement('p');
    actions.className = 'event-header-actions';
    register.classList.add('btn', 'btn-primary');
    actions.append(register);
    bar.append(actions);
  }

  await style;
  el.append(bar);
}