import jwt, { type SignOptions } from 'jsonwebtoken';

/**
 * The reporter identity CIMP needs in every hand-off token. `id` is the stable
 * id of the user *in your system* (becomes `portalUserId` in CIMP).
 */
export interface HandoffUser {
  id: string;
  name: string;
  email: string;
}

export interface MintOptions {
  /** The platform "key" you registered in CIMP (Admin → Platforms). */
  platformKey: string;
  /** The per-platform hand-off signing secret from CIMP. Server-side only. */
  secret: string;
  user: HandoffUser;
  /** Token lifetime. Default '5m'. Keep it short. */
  expiresIn?: string | number;
}

/**
 * Mint a short-lived signed hand-off token. CIMP's HandoffGuard reads the
 * (unverified) `platformKey`, loads that platform's secret, and verifies the
 * HS256 signature + expiry against it — so the signature is the entire trust
 * anchor. Sign this ONLY on the server; never expose the secret to a browser.
 */
export function mintHandoffToken(opts: MintOptions): string {
  const signOptions: SignOptions = {
    algorithm: 'HS256',
    expiresIn: (opts.expiresIn ?? '5m') as SignOptions['expiresIn'],
  };
  return jwt.sign(
    {
      platformKey: opts.platformKey,
      portalUserId: opts.user.id,
      name: opts.user.name,
      email: opts.user.email,
    },
    opts.secret,
    signOptions,
  );
}

/**
 * Build the URL to send the user to. Delivers the token exactly the way CIMP's
 * reporter surface expects (`?handoff=`), which it stores and strips from the
 * address bar on load.
 */
export function buildHandoffUrl(
  baseUrl: string,
  token: string,
  reporterPath = '/reporter/new',
): string {
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}${reporterPath}?handoff=${encodeURIComponent(token)}`;
}
