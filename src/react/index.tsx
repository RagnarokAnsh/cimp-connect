import type { AnchorHTMLAttributes, ReactElement } from 'react';

export interface GetSupportButtonProps
  extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /**
   * URL of YOUR backend's handoff endpoint (the one the backend package
   * registers), absolute or relative. Default '/api/support/handoff'.
   */
  handoffUrl?: string;
  /** Render the little life-ring icon before the label. Default true. */
  showIcon?: boolean;
}

/**
 * A drop-in "Get Support" link. It points at your backend's handoff endpoint —
 * the auth cookie/session rides along on the top-level navigation, your backend
 * mints the CIMP token server-side, and the user lands on the CIMP reporter
 * form in a new tab. No secret ever reaches the browser.
 *
 * Unstyled by design: pass className/style to match your app. Works in any
 * React app (Vite, CRA, Next.js — server or client components).
 */
export function GetSupportButton({
  handoffUrl = '/api/support/handoff',
  showIcon = true,
  children,
  ...rest
}: GetSupportButtonProps): ReactElement {
  return (
    <a href={handoffUrl} target="_blank" rel="noopener noreferrer" {...rest}>
      {showIcon && (
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
      )}
      {children ?? 'Get Support'}
    </a>
  );
}
