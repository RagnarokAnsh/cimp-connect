/**
 * Framework-agnostic Web Component: <cimp-support-button>.
 *
 * Works in Angular, Vue, Svelte, plain HTML — anywhere custom elements do.
 * (React/Next users should prefer the ergonomic '/react' export.)
 *
 * The element renders a link to YOUR backend's handoff endpoint — never to
 * CIMP directly — so no secret ever reaches the browser. Call
 * defineCimpSupportButton() once at app startup, then use the tag:
 *
 *   <cimp-support-button handoff-url="/api/support/handoff">
 *     Get Support
 *   </cimp-support-button>
 *
 * Attributes:
 *   handoff-url  URL of your backend handoff endpoint (default '/api/support/handoff')
 *   hide-icon    present → no life-ring icon
 *
 * Styling: inherits color/font from the host; target the anchor from outside
 * with `cimp-support-button::part(link) { ... }`.
 */

const ICON_SVG =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'style="width:1em;height:1em;flex:none;">' +
  '<path stroke-linecap="round" stroke-linejoin="round" ' +
  'd="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
  '</svg>';

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Register the <cimp-support-button> custom element. Safe to call multiple
 * times, and a no-op on the server (SSR/prerender) — call it unconditionally.
 */
export function defineCimpSupportButton(tagName = 'cimp-support-button'): void {
  if (typeof window === 'undefined' || typeof customElements === 'undefined') return;
  if (customElements.get(tagName)) return;

  class CimpSupportButtonElement extends HTMLElement {
    static get observedAttributes(): string[] {
      return ['handoff-url', 'hide-icon'];
    }

    connectedCallback(): void {
      this.render();
    }

    attributeChangedCallback(): void {
      if (this.isConnected) this.render();
    }

    private render(): void {
      const url = this.getAttribute('handoff-url') ?? '/api/support/handoff';
      const icon = this.hasAttribute('hide-icon') ? '' : ICON_SVG;
      const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
      root.innerHTML =
        `<a part="link" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" ` +
        'style="color:inherit;font:inherit;text-decoration:inherit;cursor:pointer;' +
        'display:inline-flex;align-items:center;gap:0.4em;">' +
        `${icon}<slot>Get Support</slot></a>`;
    }
  }

  customElements.define(tagName, CimpSupportButtonElement);
}
