import { getConfig } from '../ak.js';

// Folders whose sub-folders are event websites (or event blueprints)
const EVENT_FOLDERS = ['events', 'blueprints'];

/**
 * Returns the root folder of the event (or blueprint) the current page belongs to,
 * e.g. "/blueprints/hr-connect/" or "/de/events/hr-connect-demo/".
 * Returns null for pages that are not part of an event.
 * @param {string} pathname The path to check (defaults to the current page)
 * @returns {string|null}
 */
export default function getEventRoot(pathname = window.location.pathname) {
  const { locale } = getConfig();
  const prefix = locale?.prefix || '';
  if (prefix && !pathname.startsWith(`${prefix}/`)) return null;
  const rest = pathname.slice(prefix.length);
  const match = rest.match(new RegExp(`^/(?:${EVENT_FOLDERS.join('|')})/[^/]+/`));
  return match ? `${prefix}${match[0]}` : null;
}