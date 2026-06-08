/**
 * Turn API-relative upload paths into URLs the browser can load.
 * e.g. /uploads/photo.jpg → https://wplanner-j7a7.onrender.com/uploads/photo.jpg
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
  const apiBase =
    import.meta.env.VITE_API_BASE_URL ||
    'https://wplanner-j7a7.onrender.com/api';

  if (apiBase.startsWith('http')) {
    const origin = apiBase.replace(/\/api\/?$/, '');
    const resolved = `${origin}${normalized}`;
    return query ? `${resolved}?${query}` : resolved;
  }

  return query ? `${normalized}?${query}` : normalized;
}
