/**
 * <cimp-known-issues> — a self-hiding banner listing the staff-published
 * known issues for your platform, fetched from CIMP's public endpoint.
 *
 *   import { defineCimpKnownIssues } from '@ragnarokansh/cimp-connect/element';
 *   defineCimpKnownIssues();
 *
 *   <cimp-known-issues cimp-url="https://support.example.com" platform-key="my-app">
 *   </cimp-known-issues>
 *
 * Renders nothing at all when there are no published issues or the request
 * fails — it can never break or clutter the host app. Unstyled by design:
 * target parts from outside (`cimp-known-issues::part(list)`, `::part(item)`,
 * `::part(status)`). Refreshes on each connect; data is public + curated
 * (titles staff explicitly published — no user content).
 */

interface KnownIssue {
  title: string;
  status: string;
  updatedAt: string;
}

export function defineCimpKnownIssues(tagName = 'cimp-known-issues'): void {
  if (typeof window === 'undefined' || typeof customElements === 'undefined') return;
  if (customElements.get(tagName)) return;

  class CimpKnownIssuesElement extends HTMLElement {
    static get observedAttributes(): string[] {
      return ['cimp-url', 'platform-key'];
    }

    connectedCallback(): void {
      void this.load();
    }

    attributeChangedCallback(): void {
      if (this.isConnected) void this.load();
    }

    private async load(): Promise<void> {
      const base = (this.getAttribute('cimp-url') ?? '').replace(/\/+$/, '');
      const key = this.getAttribute('platform-key') ?? '';
      const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
      if (!base || !key) {
        root.innerHTML = '';
        return;
      }
      try {
        const res = await fetch(`${base}/api/public/platforms/${encodeURIComponent(key)}/known-issues`);
        if (!res.ok) throw new Error(String(res.status));
        const issues = (await res.json()) as KnownIssue[];
        if (!Array.isArray(issues) || issues.length === 0) {
          root.innerHTML = '';
          return;
        }
        const items = issues
          .map(
            (i) =>
              `<li part="item" style="display:flex;align-items:baseline;gap:0.5em;">`
              + `<span part="status" data-status="${escapeHtml(i.status)}" style="font-size:0.75em;opacity:0.7;">${escapeHtml(i.status)}</span>`
              + `<span part="title">${escapeHtml(i.title)}</span></li>`,
          )
          .join('');
        root.innerHTML =
          `<div part="banner" role="status" style="font:inherit;color:inherit;">`
          + `<slot>Known issues we're working on:</slot>`
          + `<ul part="list" style="margin:0.4em 0 0;padding-left:1.2em;display:flex;flex-direction:column;gap:0.25em;">${items}</ul>`
          + `</div>`;
      } catch {
        root.innerHTML = ''; // never break the host app
      }
    }
  }

  customElements.define(tagName, CimpKnownIssuesElement);
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
