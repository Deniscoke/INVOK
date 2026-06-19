import type { VercelRequest } from '@vercel/node';

/**
 * Resolve the catch-all path segments for a consolidated API route.
 *
 * Vercel normally populates `req.query.path` for a `[...path].ts` route, but
 * when a custom `rewrites` array is present in vercel.json that param can arrive
 * empty in production. We therefore treat the request URL as the source of
 * truth and fall back to it, stripping the known `/api/<base>/` prefix.
 *
 * Examples (base = 'student'):
 *   /api/student/join            → ['join']
 *   /api/student/quests/generate → ['quests', 'generate']
 *   /api/student                 → []
 *
 * @param req  incoming request
 * @param base directory name under /api, e.g. 'student', 'admin', 'teacher'
 */
export function routeSegments(req: VercelRequest, base: string): string[] {
  const fromQuery = req.query?.path;
  if (Array.isArray(fromQuery)) return fromQuery.filter((s) => s.length > 0);
  if (typeof fromQuery === 'string' && fromQuery.length > 0) {
    return fromQuery.split('/').map(decodeSafe).filter(Boolean);
  }

  // Fallback: derive from the URL path (robust to Vercel routing quirks).
  const path = (req.url ?? '').split('?')[0].replace(/\/+$/, '');
  const marker = `/api/${base}`;
  const idx = path.indexOf(marker);
  const rest = idx >= 0 ? path.slice(idx + marker.length) : path.replace(/^\/+/, '');
  return rest.split('/').map(decodeSafe).filter(Boolean);
}

function decodeSafe(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
