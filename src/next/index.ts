import { buildHandoffUrl, HandoffUser, mintHandoffToken } from '../core';
import { wantsJson } from '../negotiate';

/**
 * Next.js (App Router) adapter — a route-handler factory.
 *
 *   // app/api/support/handoff/route.ts
 *   import { createHandoffHandler } from '@ragnarokansh/cimp-connect/next';
 *
 *   export const GET = createHandoffHandler({
 *     getUser: async (req) => {
 *       const session = await auth();            // your auth (next-auth, etc.)
 *       if (!session?.user) return null;
 *       return { id: session.user.id, name: session.user.name, email: session.user.email };
 *     },
 *   });
 *
 * Config comes from CIMP_PLATFORM_KEY / CIMP_HANDOFF_SECRET / CIMP_SUPPORT_URL
 * unless overridden. Returning null/undefined from getUser → 401. The handler
 * content-negotiates exactly like the Express adapter: link navigations get a
 * 302 to CIMP, `Accept: application/json` (or ?format=json) gets `{ url }`.
 *
 * Pages Router: use the core mint/build helpers in an API route instead.
 */

export interface NextHandoffOptions {
  /**
   * Extract the reporter identity from the incoming Request (cookies/session —
   * this is the one project-specific piece). Return null when unauthenticated.
   */
  getUser: (req: Request) => HandoffUser | null | undefined | Promise<HandoffUser | null | undefined>;
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

/** Build an App Router GET handler. See module docs above. */
export function createHandoffHandler(
  options: NextHandoffOptions,
): (req: Request) => Promise<Response> {
  return async function handoffRoute(req: Request): Promise<Response> {
    const platformKey = options.platformKey ?? process.env.CIMP_PLATFORM_KEY;
    const handoffSecret = options.handoffSecret ?? process.env.CIMP_HANDOFF_SECRET;
    const baseUrl = options.baseUrl ?? process.env.CIMP_SUPPORT_URL;
    if (!platformKey || !handoffSecret || !baseUrl) {
      return json(503, {
        message:
          'cimp-connect is not configured — set CIMP_PLATFORM_KEY, CIMP_HANDOFF_SECRET and CIMP_SUPPORT_URL (run `npx cimp-connect init`).',
      });
    }

    const user = await options.getUser(req);
    if (!user || !user.id || !user.name || !user.email) {
      return json(401, { message: 'No authenticated user for this request.' });
    }

    const token = mintHandoffToken({
      platformKey,
      secret: handoffSecret,
      user,
      expiresIn: options.expiresIn,
    });
    const url = buildHandoffUrl(baseUrl, token, options.reporterPath);

    const format = new URL(req.url).searchParams.get('format') ?? undefined;
    if (wantsJson(req.headers.get('accept') ?? undefined, format)) {
      return json(200, { url });
    }
    return new Response(null, { status: 302, headers: { Location: url } });
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
