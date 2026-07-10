# @ragnarokansh/cimp-connect

Connect any backend to a **CIMP** support portal. Your app mints a
short-lived signed hand-off token for the logged-in user and redirects them to
the CIMP reporter form — no reporter accounts, no passwords. The signature is
the trust anchor, so **the secret never leaves your server.**

- **`core`** — framework-agnostic mint/URL helpers (works anywhere).
- **`/express`** — a one-line route handler: `app.get('/api/support/handoff', requireAuth, cimpHandoff())`.
- **`/nestjs`** — a drop-in `SupportModule` exposing `GET /support/handoff`.
- **`/next`** — an App Router route-handler factory.
- **`/react`** — a drop-in `<GetSupportButton />` for React/Next frontends.
- **`/element`** — a `<cimp-support-button>` Web Component for Angular, Vue, Svelte, or plain HTML.
- **`cimp-connect init`** — a CLI that registers the platform in CIMP and writes your `.env`.
- **Java / Spring Boot** — see [`java/`](java/README.md): zero-dependency core + Spring Boot auto-configuration (via JitPack).

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
# after installing the package (recommended — you need it anyway):
npx cimp-connect init

# or one-shot without installing:
npx github:RagnarokAnsh/cimp-connect init
```

> Plain `npx cimp-connect` only works once the package is installed — the
> package isn't on the public npm registry, so npx can't fetch it by name.

It logs in as a CIMP admin, creates the platform, captures its signing secret,
and appends `CIMP_PLATFORM_KEY` / `CIMP_HANDOFF_SECRET` / `CIMP_SUPPORT_URL` to
your `.env`. Then wire the adapter for your framework (below).

## Express usage

One line — config comes from the `CIMP_*` env vars the CLI wrote:

```js
const { cimpHandoff } = require('@ragnarokansh/cimp-connect/express');

app.get('/api/support/handoff', requireAuth, cimpHandoff());
```

The default `getUser` reads `req.user` and tries the common field names
(`id`/`userId`/`_id`/`sub`, `name`/`firstName + lastName`/`username`,
`email`). If your middleware stores the user differently, pass your own:

```js
app.get('/api/support/handoff', requireAuth, cimpHandoff({
  getUser: (req) => ({ id: req.auth.sub, name: req.auth.fullName, email: req.auth.email }),
}));
```

## Next.js usage (App Router)

```ts
// app/api/support/handoff/route.ts
import { createHandoffHandler } from '@ragnarokansh/cimp-connect/next';

export const GET = createHandoffHandler({
  getUser: async (req) => {
    const session = await auth();          // your auth (next-auth, etc.)
    if (!session?.user) return null;       // → 401
    return { id: session.user.id, name: session.user.name!, email: session.user.email! };
  },
});
```

(Pages Router: use the core helpers in an API route.)

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
talks to your **backend's** handoff endpoint (never to CIMP directly, so no
secret is ever in the browser), and opens the CIMP reporter form in a new tab.
Both variants are unstyled by design — style them like any element in your app.

**Pick the mode by where your auth lives.** The default is a plain link: the
session **cookie** rides along on the top-level navigation and the backend
302-redirects. If your app keeps a **JWT in an Authorization header**
(localStorage + interceptor apps), a link click carries no auth — use
`mode="fetch"`: the button requests the endpoint as JSON with your auth
header and opens the returned URL. All backend adapters content-negotiate,
so both modes work against the same endpoint with zero backend changes.

### React / Next.js — `/react`

```tsx
import { GetSupportButton } from '@ragnarokansh/cimp-connect/react';

// default: points at /api/support/handoff on the same origin
<GetSupportButton className="your-classes" />

// different API origin (e.g. Vite/Next dev, or API on another host):
<GetSupportButton handoffUrl={`${import.meta.env.VITE_API_URL}/support/handoff`} />

// header-JWT apps (token in localStorage, not a cookie):
<GetSupportButton
  mode="fetch"
  getAuthHeaders={() => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })}
/>
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

Header-JWT apps (e.g. Angular with an HttpClient interceptor — a plain link
carries no Authorization header): register with `getAuthHeaders` and add
`mode="fetch"`:

```ts
defineCimpSupportButton({
  getAuthHeaders: () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` }),
});
```

```html
<cimp-support-button mode="fetch" handoff-url="/api/support/handoff">
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
