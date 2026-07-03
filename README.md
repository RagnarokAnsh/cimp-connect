# @ragnarokansh/cimp-connect

Connect any Node backend to a **CIMP** support portal. Your app mints a
short-lived signed hand-off token for the logged-in user and redirects them to
the CIMP reporter form — no reporter accounts, no passwords. The signature is
the trust anchor, so **the secret never leaves your server.**

- **`core`** — framework-agnostic mint/URL helpers (works anywhere).
- **`/nestjs`** — a drop-in `SupportModule` exposing `GET /support/handoff`.
- **`/react`** — a drop-in `<GetSupportButton />` for React/Next frontends.
- **`/element`** — a `<cimp-support-button>` Web Component for Angular, Vue, Svelte, or plain HTML.
- **`cimp-connect init`** — a CLI that registers the platform in CIMP and writes your `.env`.

## Install

This package is published to **GitHub Packages**, so point the scope at that
registry and authenticate with a GitHub token that has `read:packages`.

`.npmrc` in your project:

```
@ragnarokansh:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```bash
npm i @ragnarokansh/cimp-connect
```

> **Note:** GitHub Packages requires authentication for *every* consumer — even
> when the repo/package is public. Each install needs a GitHub token with
> `read:packages` and the `.npmrc` above.

### Install from the public repo (no token, recommended)

Skip the registry + token entirely and install straight from GitHub — the
package builds itself on install (`prepare` script):

```bash
npm i github:RagnarokAnsh/cimp-connect
```

## Quick setup (CLI)

```bash
npx cimp-connect init
```

It logs in as a CIMP admin, creates the platform, captures its signing secret,
and appends `CIMP_PLATFORM_KEY` / `CIMP_HANDOFF_SECRET` / `CIMP_SUPPORT_URL` to
your `.env`. Then wire the module (below).

## NestJS usage

The one thing you provide is a `getUser` adapter — how to read the current user
from a request. Use `forRootAsync` when that needs an injected service:

```ts
import { SupportModule } from '@ragnarokansh/cimp-connect/nestjs';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    SupportModule.forRootAsync({
      guard: JwtAuthGuard, // protects GET /support/handoff
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        platformKey: config.get('CIMP_PLATFORM_KEY'),
        handoffSecret: config.get('CIMP_HANDOFF_SECRET'),
        baseUrl: config.get('CIMP_SUPPORT_URL'),
        getUser: (req) => ({
          id: req.user.userId,
          name: req.user.name,
          email: req.user.email,
        }),
      }),
    }),
  ],
})
export class AppModule {}
```

Then link users at `GET /api/support/handoff` (respecting your global prefix).
The auth cookie/header rides along on the top-level navigation, the module mints
a token, and 302-redirects to CIMP.

### Static config

```ts
SupportModule.forRoot({
  guard: JwtAuthGuard,
  platformKey: process.env.CIMP_PLATFORM_KEY!,
  handoffSecret: process.env.CIMP_HANDOFF_SECRET!,
  baseUrl: process.env.CIMP_SUPPORT_URL!,
  getUser: (req) => ({ id: req.user.id, name: req.user.name, email: req.user.email }),
});
```

## Frontend usage (any framework)

Install the same package in the frontend and drop the button anywhere. It
links to your **backend's** handoff endpoint (never to CIMP directly, so no
secret is ever in the browser), and opens the CIMP reporter form in a new tab.
Both variants are unstyled by design — style them like any element in your app.

### React / Next.js — `/react`

```tsx
import { GetSupportButton } from '@ragnarokansh/cimp-connect/react';

// default: points at /api/support/handoff on the same origin
<GetSupportButton className="your-classes" />

// different API origin (e.g. Vite/Next dev, or API on another host):
<GetSupportButton handoffUrl={`${import.meta.env.VITE_API_URL}/support/handoff`} />
```

Works in Vite, CRA, and Next.js (server or client components).

### Angular / Vue / Svelte / plain HTML — `/element`

Register the Web Component once at startup (safe to call anywhere; no-op on
the server), then use the tag:

```ts
// Angular: main.ts   ·   Vue: main.ts   ·   Svelte: entry file
import { defineCimpSupportButton } from '@ragnarokansh/cimp-connect/element';
defineCimpSupportButton();
```

```html
<cimp-support-button handoff-url="/api/support/handoff">
  Get Support
</cimp-support-button>
```

- **Angular:** add `CUSTOM_ELEMENTS_SCHEMA` to the module/component `schemas`
  so the template compiler accepts the custom tag.
- **Vue 3:** optionally mark it as a custom element
  (`compilerOptions.isCustomElement = (t) => t === 'cimp-support-button'`)
  to silence the unknown-component warning.
- **Styling:** it inherits `color`/`font`; target the inner link with
  `cimp-support-button::part(link) { ... }`. Add `hide-icon` to drop the icon.

## Core (any framework)

```ts
import { mintHandoffToken, buildHandoffUrl } from '@ragnarokansh/cimp-connect';

const token = mintHandoffToken({
  platformKey: 'my-app',
  secret: process.env.CIMP_HANDOFF_SECRET!,
  user: { id: user.id, name: user.name, email: user.email },
});
const url = buildHandoffUrl(process.env.CIMP_SUPPORT_URL!, token);
// res.redirect(url)  — Express, Fastify, Next route handler, etc.
```

## Options

| Option | Required | Default | Notes |
|---|---|---|---|
| `platformKey` | ✓ | — | The key you registered in CIMP. |
| `handoffSecret` | ✓ | — | Per-platform secret from CIMP. **Server-side only.** |
| `baseUrl` | ✓ | — | CIMP base URL. |
| `getUser` | ✓ | — | `(req) => { id, name, email }` (may be async). |
| `guard` | — | none | Auth guard applied to the handoff route. |
| `route` | — | `support` | `GET /<route>/handoff`. |
| `reporterPath` | — | `/reporter/new` | Path on CIMP to land on. |
| `expiresIn` | — | `5m` | Token lifetime. |

## License

UNLICENSED — internal use.
