import { API_ORIGIN } from '../services/api';

/**
 * Turn API-relative upload paths into URLs the browser can load.
 * e.g. /uploads/photo.jpg → http://localhost:3000/uploads/photo.jpg (or remote origin)
 */
export function resolveMediaUrl(url) {
  if (!url) return undefined;

  const [path, query] = String(url).split('?');

  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('data:')
  ) {
    return query ? `${path}?${query}` : path;
  }

  const normalized = path.startsWith('/') ? path : `/${path}`;
  const origin = (API_ORIGIN || '').replace(/\/api\/?$/, '');

  if (origin && origin.startsWith('http')) {
    const resolved = `${origin}${normalized}`;
    return query ? `${resolved}?${query}` : resolved;
  }

  return query ? `${normalized}?${query}` : normalized;
}
