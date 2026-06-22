/**
 * Public site URL for share links.
 * - Empty on GitHub Pages: auto-uses window.location.origin + pathname.
 * - Set when developing on localhost so generated links point to the deployed site.
 */
export const PUBLIC_BASE_URL = 'https://kangshengyang888-sketch.github.io/cipher-garden/';

function isLocalHost() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

/** Base URL for share links (no hash/query). Always ends with `/`. */
export function getPublicBaseUrl() {
  if (isLocalHost() && PUBLIC_BASE_URL) {
    return PUBLIC_BASE_URL.endsWith('/') ? PUBLIC_BASE_URL : `${PUBLIC_BASE_URL}/`;
  }
  const path = window.location.pathname.replace(/index\.html$/, '');
  const normalized = path.endsWith('/') ? path : `${path}/`;
  return `${window.location.origin}${normalized}`;
}

/** True when localhost dev uses PUBLIC_BASE_URL override for share links. */
export function isUsingPublicOverride() {
  return isLocalHost() && !!PUBLIC_BASE_URL;
}
