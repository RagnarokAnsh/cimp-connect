/**
 * Decide how a handoff endpoint should answer.
 *
 * Top-level link navigations (the stock link button) send `Accept: text/html`
 * and expect a 302 redirect. Programmatic clients — an Angular HttpClient with
 * a JWT interceptor, the `mode="fetch"` buttons — send `Accept:
 * application/json` (or `?format=json`) and get `{ "url": ... }` back so the
 * frontend can `window.open` it with the user's auth header attached.
 */
export function wantsJson(
  acceptHeader: string | undefined,
  formatParam: string | undefined,
): boolean {
  if (formatParam === 'json') return true;
  const accept = acceptHeader ?? '';
  return accept.includes('application/json') && !accept.includes('text/html');
}
