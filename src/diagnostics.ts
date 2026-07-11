/**
 * Client-side diagnostics for pre-diagnosed issue reports.
 *
 * Call initCimpDiagnostics() once at app startup. It passively records:
 *  - console errors / uncaught errors / unhandled rejections (last 20)
 *  - FAILED network requests — method, redacted URL, status; never bodies,
 *    never headers (last 10)
 *  - route breadcrumbs from history navigation (last 10)
 *
 * When the user clicks Get Support (fetch mode), the buttons append the
 * collected context to the handoff URL as a #cimpctx= FRAGMENT. Fragments are
 * never sent to any server — no logs, no CORS — the CIMP reporter form reads
 * it client-side, shows the reporter what's attached, and lets them remove it.
 *
 * Privacy: request/response bodies, headers, cookies and storage are never
 * touched. URLs are redacted (token/key/secret/password/auth/code/session
 * query values stripped). Everything is size-clamped.
 */

export interface CimpDiagnosticsConfig {
  /** Your app's version string — shown to support staff. */
  appVersion?: string;
  /** Deploy/release identifier (git SHA, build number…). */
  release?: string;
  /** Extra key/values to attach (feature flags, tenant, …). Called at click time. */
  extra?: () => Record<string, unknown>;
}

export interface CimpContext {
  sdkVersion: string;
  appVersion?: string;
  release?: string;
  url: string;
  userAgent: string;
  language: string;
  timezone: string;
  viewport: { w: number; h: number };
  consoleErrors: string[];
  failedRequests: { method: string; url: string; status: number | null; ts: string }[];
  breadcrumbs: { path: string; ts: string }[];
  extra?: Record<string, unknown>;
}

const SDK_VERSION = '0.5.0';
const MAX_CONSOLE = 20;
const MAX_REQUESTS = 10;
const MAX_CRUMBS = 10;
const MAX_STR = 500;
/** Hard cap on the encoded fragment; beyond it arrays are dropped, then null. */
const MAX_FRAGMENT_CHARS = 48 * 1024;

interface DiagState {
  config: CimpDiagnosticsConfig;
  consoleErrors: string[];
  failedRequests: CimpContext['failedRequests'];
  breadcrumbs: CimpContext['breadcrumbs'];
}

let state: DiagState | null = null;

const redactUrl = (url: string): string =>
  url.replace(/([?&](?:token|key|secret|password|auth[^=&]*|code|session[^=&]*)=)[^&#]*/gi, '$1[redacted]');

const clampStr = (s: string): string => (s.length > MAX_STR ? `${s.slice(0, MAX_STR)}…` : s);

function push<T>(arr: T[], item: T, max: number): void {
  arr.push(item);
  if (arr.length > max) arr.shift();
}

function stringify(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function recordFailedRequest(method: string, url: string, status: number | null): void {
  if (!state) return;
  push(
    state.failedRequests,
    { method: method.toUpperCase(), url: clampStr(redactUrl(url)), status, ts: new Date().toISOString() },
    MAX_REQUESTS,
  );
}

/**
 * Install the collectors. Idempotent; SSR-safe (no-op without a window) —
 * call it unconditionally at startup, alongside defineCimpSupportButton().
 */
export function initCimpDiagnostics(config: CimpDiagnosticsConfig = {}): void {
  if (typeof window === 'undefined') return;
  if (state) {
    state.config = config;
    return;
  }
  state = { config, consoleErrors: [], failedRequests: [], breadcrumbs: [] };
  const s = state;

  window.addEventListener('error', (e) => {
    push(s.consoleErrors, clampStr(`${e.message}${e.filename ? ` (${e.filename}:${e.lineno})` : ''}`), MAX_CONSOLE);
  });
  window.addEventListener('unhandledrejection', (e) => {
    push(s.consoleErrors, clampStr(`Unhandled rejection: ${stringify(e.reason)}`), MAX_CONSOLE);
  });

  const origConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    origConsoleError(...args);
    try {
      push(s.consoleErrors, clampStr(args.map(stringify).join(' ')), MAX_CONSOLE);
    } catch {
      /* never break the host app's logging */
    }
  };

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method =
      init?.method ?? (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET');
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      const res = await origFetch(input, init);
      if (!res.ok) recordFailedRequest(method, url, res.status);
      return res;
    } catch (err) {
      recordFailedRequest(method, url, null); // network error / CORS / abort
      throw err;
    }
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    (this as any).__cimpReq = { method, url: String(url) };
    return (origOpen as any).apply(this, [method, url, ...rest]);
  };
  XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, ...args: unknown[]) {
    this.addEventListener('loadend', () => {
      const meta = (this as any).__cimpReq;
      if (meta && (this.status === 0 || this.status >= 400)) {
        recordFailedRequest(meta.method, meta.url, this.status || null);
      }
    });
    return (origSend as any).apply(this, args);
  };

  const crumb = (): void => {
    const last = s.breadcrumbs[s.breadcrumbs.length - 1];
    if (last?.path === window.location.pathname) return;
    push(s.breadcrumbs, { path: window.location.pathname, ts: new Date().toISOString() }, MAX_CRUMBS);
  };
  crumb();
  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);
  history.pushState = (...a: Parameters<History['pushState']>) => { origPush(...a); crumb(); };
  history.replaceState = (...a: Parameters<History['replaceState']>) => { origReplace(...a); crumb(); };
  window.addEventListener('popstate', crumb);
}

/** Snapshot the current context, or null when diagnostics were never initialized. */
export function collectContext(): CimpContext | null {
  if (!state || typeof window === 'undefined') return null;
  let extra: Record<string, unknown> | undefined;
  try {
    extra = state.config.extra?.();
  } catch {
    extra = undefined;
  }
  return {
    sdkVersion: SDK_VERSION,
    appVersion: state.config.appVersion,
    release: state.config.release,
    url: window.location.pathname,
    userAgent: navigator.userAgent,
    language: navigator.language,
    timezone: (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; }
    })(),
    viewport: { w: window.innerWidth, h: window.innerHeight },
    consoleErrors: [...state.consoleErrors],
    failedRequests: [...state.failedRequests],
    breadcrumbs: [...state.breadcrumbs],
    ...(extra ? { extra } : {}),
  };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function gzip(text: string): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Encode a context for the URL fragment: `1.<b64url(gzip(json))>`, or
 * `0.<b64url(utf8 json)>` where CompressionStream is unavailable. Over the
 * size cap, arrays are dropped largest-first; null if it still won't fit.
 */
export async function encodeContextFragment(ctx: CimpContext): Promise<string | null> {
  const attempts: CimpContext[] = [
    ctx,
    { ...ctx, breadcrumbs: [] },
    { ...ctx, breadcrumbs: [], failedRequests: [] },
    { ...ctx, breadcrumbs: [], failedRequests: [], consoleErrors: [] },
  ];
  for (const attempt of attempts) {
    const json = JSON.stringify(attempt);
    const zipped = await gzip(json);
    const encoded = zipped
      ? `1.${base64UrlEncode(zipped)}`
      : `0.${base64UrlEncode(new TextEncoder().encode(json))}`;
    if (encoded.length <= MAX_FRAGMENT_CHARS) return encoded;
  }
  return null;
}

/**
 * Append the current diagnostics to a handoff URL as a #cimpctx= fragment.
 * Returns the URL unchanged when diagnostics are uninitialized/empty or the
 * payload cannot fit. Used internally by the fetch-mode buttons.
 */
export async function appendContextToUrl(url: string): Promise<string> {
  const ctx = collectContext();
  if (!ctx) return url;
  try {
    const encoded = await encodeContextFragment(ctx);
    return encoded ? `${url}#cimpctx=${encoded}` : url;
  } catch {
    return url;
  }
}
