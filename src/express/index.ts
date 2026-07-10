import { buildHandoffUrl, HandoffUser, mintHandoffToken } from '../core';
import { wantsJson } from '../negotiate';

/**
 * Express adapter: one route handler and you're connected.
 *
 *   const { cimpHandoff } = require('@ragnarokansh/cimp-connect/express');
 *   app.get('/api/support/handoff', requireAuth, cimpHandoff());
 *
 * Config comes from CIMP_PLATFORM_KEY / CIMP_HANDOFF_SECRET / CIMP_SUPPORT_URL
 * (written by `npx cimp-connect init`) unless overridden in options. The
 * default getUser reads `req.user` and tries the common id/name shapes; pass
 * your own when your auth middleware stores the user differently.
 *
 * The handler content-negotiates: browser link clicks (Accept: text/html) get
 * a 302 to CIMP; fetch/XHR clients that send Accept: application/json (or
 * `?format=json`) get `{ "url": ... }` to open themselves — that's the path
 * for apps whose auth lives in an Authorization header instead of a cookie.
 */

export interface ExpressHandoffOptions {
  /**
   * Extract the reporter identity from the (already-authenticated) request.
   * Defaults to reading `req.user` and trying common field names. May be async.
   */
  getUser?: (req: any) => HandoffUser | null | undefined | Promise<HandoffUser | null | undefined>;
  /** Platform key registered in CIMP. Default: env CIMP_PLATFORM_KEY. */
  platformKey?: string;
  /** Per-platform signing secret. Default: env CIMP_HANDOFF_SECRET. */
  handoffSecret?: string;
  /** CIMP base URL. Default: env CIMP_SUPPORT_URL. */
  baseUrl?: string;
  /** Reporter path on CIMP. Default '/reporter/new'. */
  reporterPath?: string;
  /** Token lifetime. Default '5m'. */
  expiresIn?: string | number;
}

/** Best-effort mapping of the shapes auth middlewares commonly put on req.user. */
export function defaultGetUser(req: any): HandoffUser | null {
  const u = req?.user;
  if (!u) return null;
  const id = u.id ?? u.userId ?? u._id ?? u.sub;
  const email = u.email;
  const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  const name = u.name || fullName || u.username || email;
  if (!id || !email || !name) return null;
  return { id: String(id), name: String(name), email: String(email) };
}

/** Build the Express handler. See module docs above. */
export function cimpHandoff(options: ExpressHandoffOptions = {}) {
  return async function cimpHandoffHandler(req: any, res: any, next?: (err: unknown) => void): Promise<void> {
    try {
      const platformKey = options.platformKey ?? process.env.CIMP_PLATFORM_KEY;
      const handoffSecret = options.handoffSecret ?? process.env.CIMP_HANDOFF_SECRET;
      const baseUrl = options.baseUrl ?? process.env.CIMP_SUPPORT_URL;
      if (!platformKey || !handoffSecret || !baseUrl) {
        res.status(503).json({
          message:
            'cimp-connect is not configured — set CIMP_PLATFORM_KEY, CIMP_HANDOFF_SECRET and CIMP_SUPPORT_URL (run `npx cimp-connect init`).',
        });
        return;
      }

      const user = await (options.getUser ?? defaultGetUser)(req);
      if (!user || !user.id || !user.name || !user.email) {
        res.status(401).json({
          message:
            'No authenticated user on the request — guard this route with your auth middleware (or pass a custom getUser).',
        });
        return;
      }

      const token = mintHandoffToken({
        platformKey,
        secret: handoffSecret,
        user,
        expiresIn: options.expiresIn,
      });
      const url = buildHandoffUrl(baseUrl, token, options.reporterPath);

      if (wantsJson(req.headers?.accept, req.query?.format)) {
        res.json({ url });
      } else {
        res.redirect(url);
      }
    } catch (err) {
      if (next) next(err);
      else throw err;
    }
  };
}
