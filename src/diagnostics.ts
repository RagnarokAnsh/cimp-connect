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
  /**
   * Screenshot hook, called at click time. Return a canvas (e.g. from
   * html2canvas or the exported displayMediaScreenshot helper), a Blob, a
   * data-URL string, or null to skip. The image is downscaled to ≤1200px JPEG
   * and shown to the reporter on the CIMP form (removable) before it is
   * submitted as a normal attachment.
   */
  captureScreenshot?: () =>
    | Promise<Blob | HTMLCanvasElement | string | null>
    | Blob | HTMLCanvasElement | string | null;
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
/** With a screenshot attached the fragment may grow to this (browsers accept far larger URLs). */
const MAX_FRAGMENT_WITH_SCREENSHOT_CHARS = 480 * 1024;
/** Encoded screenshot budget (data-URL chars ≈ bytes × 4/3). */
const MAX_SCREENSHOT_CHARS = 360_000;
const SCREENSHOT_MAX_WIDTH = 1_200;

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
 * size cap, the screenshot is dropped first, then arrays largest-first; null
 * if it still won't fit.
 */
export async function encodeContextFragment(
  ctx: CimpContext & { screenshot?: string },
  maxChars: number = MAX_FRAGMENT_CHARS,
): Promise<string | null> {
  const { screenshot, ...bare } = ctx;
  const attempts: (CimpContext & { screenshot?: string })[] = [
    ctx,
    ...(screenshot ? [bare as CimpContext] : []),
    { ...bare, breadcrumbs: [] },
    { ...bare, breadcrumbs: [], failedRequests: [] },
    { ...bare, breadcrumbs: [], failedRequests: [], consoleErrors: [] },
  ];
  for (const attempt of attempts) {
    const json = JSON.stringify(attempt);
    const zipped = await gzip(json);
    const encoded = zipped
      ? `1.${base64UrlEncode(zipped)}`
      : `0.${base64UrlEncode(new TextEncoder().encode(json))}`;
    // Once the screenshot is dropped, fall back to the tight default cap.
    const cap = 'screenshot' in attempt && attempt.screenshot ? maxChars : MAX_FRAGMENT_CHARS;
    if (encoded.length <= cap) return encoded;
  }
  return null;
}

// Normalize whatever the captureScreenshot hook returned into a downscaled
// JPEG data URL, or null when it can't be made to fit.
async function normalizeScreenshot(
  raw: Blob | HTMLCanvasElement | string | null,
): Promise<string | null> {
  if (!raw) return null;
  let bitmapSource: CanvasImageSource | null = null;
  let width = 0;
  let height = 0;

  if (typeof HTMLCanvasElement !== 'undefined' && raw instanceof HTMLCanvasElement) {
    bitmapSource = raw;
    width = raw.width;
    height = raw.height;
  } else {
    // The typeof-guarded instanceof above doesn't narrow for TS — assert here.
    const nonCanvas = raw as Blob | string;
    const blob = typeof nonCanvas === 'string' ? await (await fetch(nonCanvas)).blob() : nonCanvas;
    if (!blob.type.startsWith('image/')) return null;
    const bitmap = await createImageBitmap(blob);
    bitmapSource = bitmap;
    width = bitmap.width;
    height = bitmap.height;
  }
  if (!width || !height) return null;

  const scale = Math.min(1, SCREENSHOT_MAX_WIDTH / width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) return null;
  ctx2d.drawImage(bitmapSource, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.55, 0.35]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_SCREENSHOT_CHARS) return dataUrl;
  }
  return null; // too large even at low quality — skip rather than blow the URL
}

/**
 * Append the current diagnostics (and, when configured, a screenshot) to a
 * handoff URL as a #cimpctx= fragment. Returns the URL unchanged when
 * diagnostics are uninitialized/empty or the payload cannot fit. Used
 * internally by the fetch-mode buttons.
 */
export async function appendContextToUrl(url: string): Promise<string> {
  const ctx = collectContext();
  if (!ctx) return url;
  try {
    let screenshot: string | null = null;
    if (state?.config.captureScreenshot) {
      try {
        screenshot = await normalizeScreenshot(await state.config.captureScreenshot());
      } catch {
        screenshot = null; // a failed capture must never block the handoff
      }
    }
    const payload = screenshot
      ? ({ ...ctx, screenshot } as CimpContext & { screenshot: string })
      : ctx;
    const encoded = await encodeContextFragment(
      payload,
      screenshot ? MAX_FRAGMENT_WITH_SCREENSHOT_CHARS : MAX_FRAGMENT_CHARS,
    );
    return encoded ? `${url}#cimpctx=${encoded}` : url;
  } catch {
    return url;
  }
}

/**
 * Dependency-free screenshot source using the browser's screen-share picker
 * (the user chooses what to share; one frame is grabbed, then the stream
 * stops). Pass as `captureScreenshot: displayMediaScreenshot`. Apps that use
 * html2canvas can pass `() => html2canvas(document.body)` instead — no
 * permission prompt.
 */
export async function displayMediaScreenshot(): Promise<HTMLCanvasElement | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) return null;
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((r) => setTimeout(r, 200)); // let the first frame land
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    return canvas.width > 0 ? canvas : null;
  } catch {
    return null; // user dismissed the picker
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}
