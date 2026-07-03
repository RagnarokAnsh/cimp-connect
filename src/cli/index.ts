#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';

/**
 * `cimp-connect init` — one command to connect the current project to CIMP:
 *   1. logs in as a CIMP admin,
 *   2. creates a platform,
 *   3. rotates + captures its signing secret,
 *   4. writes CIMP_* vars into .env,
 *   5. prints the SupportModule snippet to add.
 */
async function init(): Promise<void> {
  const rl = readline.createInterface({ input, output });
  try {
    const baseUrl = (await rl.question('CIMP base URL (e.g. https://35.154.196.105): '))
      .trim()
      .replace(/\/+$/, '');
    const email = (await rl.question('CIMP admin email: ')).trim();
    const password = (await rl.question('CIMP admin password: ')).trim();
    const key = (await rl.question('New platform key (lowercase, e.g. my-app): ')).trim();
    const name = (await rl.question('Platform display name: ')).trim();

    console.log('\n→ Logging in to CIMP…');
    const login = await api(`${baseUrl}/api/auth/login`, 'POST', { email, password });
    const token: string | undefined = login.accessToken;
    if (!token) throw new Error('Login failed — no accessToken returned.');

    console.log('→ Creating platform…');
    const platform = await api(`${baseUrl}/api/admin/platforms`, 'POST', { key, name }, token);

    console.log('→ Fetching signing secret…');
    const rotated = await api(
      `${baseUrl}/api/admin/platforms/${platform.id}/rotate-secret`,
      'POST',
      undefined,
      token,
    );
    const secret: string | undefined = rotated.handoffSecret;
    if (!secret) throw new Error('Could not obtain a hand-off secret from CIMP.');

    const block = [
      '',
      '# CIMP support integration (added by `cimp-connect init`)',
      `CIMP_PLATFORM_KEY=${key}`,
      `CIMP_HANDOFF_SECRET=${secret}`,
      `CIMP_SUPPORT_URL=${baseUrl}`,
      '',
    ].join('\n');

    const envPath = '.env';
    if (existsSync(envPath) && readFileSync(envPath, 'utf8').includes('CIMP_HANDOFF_SECRET')) {
      console.log('\n⚠  .env already contains CIMP_HANDOFF_SECRET — not overwriting. Values:');
      console.log(block);
    } else {
      appendFileSync(envPath, block);
      console.log(`\n✓ Wrote CIMP_* variables to ${envPath}`);
    }

    printNextSteps();
  } finally {
    rl.close();
  }
}

function printNextSteps(): void {
  console.log(`
Next steps
──────────
1) Install the package (if you haven't):
     npm i @ragnarokansh/cimp-connect

2) Register the module in your AppModule — supply ONE getUser adapter:

     import { SupportModule } from '@ragnarokansh/cimp-connect/nestjs';
     import { ConfigService } from '@nestjs/config';
     import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

     SupportModule.forRootAsync({
       guard: JwtAuthGuard,
       inject: [ConfigService],
       useFactory: (config: ConfigService) => ({
         platformKey:   config.get('CIMP_PLATFORM_KEY'),
         handoffSecret: config.get('CIMP_HANDOFF_SECRET'),
         baseUrl:       config.get('CIMP_SUPPORT_URL'),
         // adapt this line to your auth — return { id, name, email }:
         getUser: (req) => ({ id: req.user.userId, name: req.user.name, email: req.user.email }),
       }),
     })

3) Frontend: install the same package and drop in the button:

     import { GetSupportButton } from '@ragnarokansh/cimp-connect/react';
     <GetSupportButton handoffUrl="/api/support/handoff" />

   (or any plain link/button pointing at GET /api/support/handoff).
`);
}

async function api(url: string, method: string, body?: unknown, token?: string): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message ?? text;
    throw new Error(`${method} ${url} → ${res.status}: ${msg}`);
  }
  return data;
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === 'init') {
    await init();
    return;
  }
  console.log('cimp-connect — connect a Node backend to a CIMP support portal\n');
  console.log('Usage:\n  cimp-connect init    Register this project as a CIMP platform and write .env');
  process.exit(cmd ? 1 : 0);
}

main().catch((e: Error) => {
  console.error('\n✗', e.message);
  process.exit(1);
});
