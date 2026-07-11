/**
 * Framework-agnostic Web Component: <cimp-support-button>.
 *
 * Works in Angular, Vue, Svelte, plain HTML — anywhere custom elements do.
 * (React/Next users should prefer the ergonomic '/react' export.)
 *
 * The element talks to YOUR backend's handoff endpoint — never to CIMP
 * directly — so no secret ever reaches the browser. Call
 * defineCimpSupportButton() once at app startup, then use the tag:
 *
 *   <cimp-support-button handoff-url="/api/support/handoff">
 *     Get Support
 *   </cimp-support-button>
 *
 * Two modes:
 *   (default)     a plain link — the session cookie rides along on the
 *                 top-level navigation and the backend 302-redirects to CIMP.
 *   mode="fetch"  fetches the endpoint as JSON and opens the returned URL —
 *                 use this when auth lives in an Authorization header (JWT in
 *                 localStorage + interceptor apps). Supply the header once at
 *                 registration:
 *
 *   defineCimpSupportButton({
 *     getAuthHeaders: () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` }),
 *   });
 *
 * Attributes:
 *   handoff-url  URL of your backend handoff endpoint (default '/api/support/handoff')
 *   mode         'fetch' → JSON fetch + window.open; omit for plain link
 *   credentials  fetch mode: 'same-origin' (default) | 'include' | 'omit'
 *   hide-icon    present → no life-ring icon
 *
 * Styling: inherits color/font from the host; target the anchor/button from
 * outside with `cimp-support-button::part(link) { ... }`.
 */

import { appendContextToUrl } from '../diagnostics';

const ICON_SVG =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'style="width:1em;height:1em;flex:none;">' +
  '<path stroke-linecap="round" stroke-linejoin="round" ' +
  'd="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
  '</svg>';

const SHARED_STYLE =
  'color:inherit;font:inherit;text-decoration:inherit;cursor:pointer;' +
  'display:inline-flex;align-items:center;gap:0.4em;';

export interface CimpSupportButtonConfig {
  /**
   * fetch mode: extra headers for the handoff request — return your
   * Authorization header here. May be async.
   */
  getAuthHeaders?: () =>
    | Record<string, string>
    | Promise<Record<string, string>>;
  /** fetch mode: called when the handoff request fails. Default: console.error. */
  onError?: (error: unknown) => void;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Register the <cimp-support-button> custom element. Safe to call multiple
 * times, and a no-op on the server (SSR/prerender) — call it unconditionally.
 * Pass a config object (or a custom tag name, or both).
 */
export function defineCimpSupportButton(
  tagNameOrConfig?: string | CimpSupportButtonConfig,
  maybeConfig?: CimpSupportButtonConfig,
): void {
  const tagName =
    typeof tagNameOrConfig === 'string' ? tagNameOrConfig : 'cimp-support-button';
  const config: CimpSupportButtonConfig =
    (typeof tagNameOrConfig === 'object' ? tagNameOrConfig : maybeConfig) ?? {};

  if (typeof window === 'undefined' || typeof customElements === 'undefined') return;
  if (customElements.get(tagName)) return;

  class CimpSupportButtonElement extends HTMLElement {
    static get observedAttributes(): string[] {
      return ['handoff-url', 'hide-icon', 'mode', 'credentials'];
    }

    connectedCallback(): void {
      this.render();
    }

    attributeChangedCallback(): void {
      if (this.isConnected) this.render();
    }

    private get handoffUrl(): string {
      return this.getAttribute('handoff-url') ?? '/api/support/handoff';
    }

    private render(): void {
      const icon = this.hasAttribute('hide-icon') ? '' : ICON_SVG;
      const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });

      if (this.getAttribute('mode') === 'fetch') {
        root.innerHTML =
          `<button part="link" type="button" style="background:none;border:none;padding:0;${SHARED_STYLE}">` +
          `${icon}<slot>Get Support</slot></button>`;
        root.querySelector('button')!.addEventListener('click', () => {
          void this.openViaFetch();
        });
        return;
      }

      root.innerHTML =
        `<a part="link" href="${escapeAttr(this.handoffUrl)}" target="_blank" rel="noopener noreferrer" ` +
        `style="${SHARED_STYLE}">` +
        `${icon}<slot>Get Support</slot></a>`;
    }

    private async openViaFetch(): Promise<void> {
      // Open the tab synchronously (inside the click) so popup blockers allow
      // it, then point it at the CIMP URL once the backend answers.
      const win = window.open('', '_blank');
      try {
        const headers: Record<string, string> = {
          accept: 'application/json',
          ...(config.getAuthHeaders ? await config.getAuthHeaders() : {}),
        };
        const credentials = (this.getAttribute('credentials') ??
          'same-origin') as RequestCredentials;
        const res = await fetch(this.handoffUrl, { headers, credentials });
        if (!res.ok) throw new Error(`Handoff request failed: ${res.status}`);
        const { url } = (await res.json()) as { url: string };
        // Diagnostics ride the URL FRAGMENT (never sent to any server); no-op
        // unless the host app called initCimpDiagnostics().
        const target = await appendContextToUrl(url);
        if (win) win.location.href = target;
        else window.open(target, '_blank');
      } catch (error) {
        win?.close();
        if (config.onError) config.onError(error);
        else console.error('[cimp-connect] handoff failed:', error);
      }
    }
  }

  customElements.define(tagName, CimpSupportButtonElement);
}
