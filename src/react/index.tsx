'use client';

import { useEffect, useState } from 'react';
import type { AnchorHTMLAttributes, HTMLAttributes, ReactElement, ReactNode } from 'react';
import { appendContextToUrl } from '../diagnostics';

export interface GetSupportButtonProps
  extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /**
   * URL of YOUR backend's handoff endpoint (the one the backend package
   * registers), absolute or relative. Default '/api/support/handoff'.
   */
  handoffUrl?: string;
  /** Render the little life-ring icon before the label. Default true. */
  showIcon?: boolean;
  /**
   * 'link' (default): plain link — the session cookie rides along on the
   * top-level navigation. 'fetch': calls the endpoint with fetch() and opens
   * the returned URL — use this when your auth lives in an Authorization
   * header (JWT in localStorage etc.) instead of a cookie.
   */
  mode?: 'link' | 'fetch';
  /**
   * fetch mode only: extra headers for the handoff request — return your
   * Authorization header here. May be async.
   */
  getAuthHeaders?: () =>
    | Record<string, string>
    | Promise<Record<string, string>>;
  /** fetch mode only: fetch credentials. Default 'same-origin'. */
  credentials?: RequestCredentials;
  /** fetch mode only: called when the handoff request fails. */
  onHandoffError?: (error: unknown) => void;
}

/**
 * A drop-in "Get Support" button. In 'link' mode it points at your backend's
 * handoff endpoint — the auth cookie rides along on the top-level navigation,
 * your backend mints the CIMP token server-side, and the user lands on the
 * CIMP reporter form in a new tab. In 'fetch' mode it requests the URL as
 * JSON (with your auth headers) and opens it — for header-JWT apps. Either
 * way, no secret ever reaches the browser.
 *
 * Unstyled by design: pass className/style to match your app. Works in any
 * React app (Vite, CRA, Next.js — server or client components).
 */
export function GetSupportButton({
  handoffUrl = '/api/support/handoff',
  showIcon = true,
  mode = 'link',
  getAuthHeaders,
  credentials = 'same-origin',
  onHandoffError,
  children,
  ...rest
}: GetSupportButtonProps): ReactElement {
  const icon = showIcon && (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      style={{
        width: '1em',
        height: '1em',
        verticalAlign: '-0.125em',
        marginRight: '0.4em',
      }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );

  if (mode === 'fetch') {
    const onClick = async (): Promise<void> => {
      // Open the tab synchronously (inside the click) so popup blockers allow
      // it, then point it at the CIMP URL once the backend answers.
      const win = window.open('', '_blank');
      try {
        const headers: Record<string, string> = {
          accept: 'application/json',
          ...(getAuthHeaders ? await getAuthHeaders() : {}),
        };
        const res = await fetch(handoffUrl, { headers, credentials });
        if (!res.ok) throw new Error(`Handoff request failed: ${res.status}`);
        const { url } = (await res.json()) as { url: string };
        // Diagnostics ride the URL FRAGMENT (never sent to any server); no-op
        // unless the app called initCimpDiagnostics().
        const target = await appendContextToUrl(url);
        if (win) win.location.href = target;
        else window.open(target, '_blank');
      } catch (error) {
        win?.close();
        if (onHandoffError) onHandoffError(error);
        else console.error('[cimp-connect] handoff failed:', error);
      }
    };
    return (
      <button
        type="button"
        onClick={() => void onClick()}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: 'inherit',
          font: 'inherit',
          cursor: 'pointer',
        }}
        {...(rest as Record<string, unknown>)}
      >
        {icon}
        {children ?? 'Get Support'}
      </button>
    );
  }

  return (
    <a href={handoffUrl} target="_blank" rel="noopener noreferrer" {...rest}>
      {icon}
      {children ?? 'Get Support'}
    </a>
  );
}

interface KnownIssue {
  title: string;
  status: string;
  updatedAt: string;
}

/**
 * Staff-published known issues for your platform, fetched from CIMP's public
 * endpoint. Renders nothing when the list is empty or the request fails — it
 * can never break the host app. Unstyled; pass className/style.
 */
export function KnownIssues({
  cimpUrl,
  platformKey,
  title = "Known issues we're working on:",
  ...rest
}: {
  cimpUrl: string;
  platformKey: string;
  title?: ReactNode;
} & HTMLAttributes<HTMLDivElement>): ReactElement | null {
  const [issues, setIssues] = useState<KnownIssue[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const base = cimpUrl.replace(/\/+$/, '');
    fetch(`${base}/api/public/platforms/${encodeURIComponent(platformKey)}/known-issues`)
      .then(async (res) => (res.ok ? ((await res.json()) as KnownIssue[]) : []))
      .then((list) => { if (!cancelled) setIssues(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) setIssues([]); });
    return () => { cancelled = true; };
  }, [cimpUrl, platformKey]);

  if (!issues || issues.length === 0) return null;
  return (
    <div role="status" {...rest}>
      {title}
      <ul style={{ margin: '0.4em 0 0', paddingLeft: '1.2em' }}>
        {issues.map((i, idx) => (
          <li key={idx} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5em' }}>
            <span style={{ fontSize: '0.75em', opacity: 0.7 }}>{i.status}</span>
            <span>{i.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
