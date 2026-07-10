import {
  CanActivate,
  Controller,
  Get,
  Req,
  Res,
  Type,
  UseGuards,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { wantsJson } from '../negotiate';

/** Minimal structural type for the express-style response (no express dep). */
interface RedirectResponse {
  redirect(url: string): void;
  json(body: unknown): void;
}

/**
 * Builds the /support controller at module-definition time so the consumer's
 * auth guard (a runtime class) can be applied to the route. A logged-in user
 * hits GET /<route>/handoff; we mint a token and 302-redirect to CIMP.
 * Clients that send Accept: application/json (or ?format=json) — e.g. an
 * Angular HttpClient whose interceptor carries the auth header — get
 * `{ url }` back to open themselves instead of a redirect.
 */
export function createSupportController(
  guard?: Type<CanActivate>,
  route = 'support',
): Type<any> {
  @Controller(route)
  class SupportController {
    constructor(readonly support: SupportService) {}

    @Get('handoff')
    async handoff(@Req() req: any, @Res() res: RedirectResponse): Promise<void> {
      const url = await this.support.handoffUrlForRequest(req);
      if (wantsJson(req.headers?.accept, req.query?.format)) {
        res.json({ url });
      } else {
        res.redirect(url);
      }
    }
  }

  if (guard) {
    // Apply the consumer's guard to the generated controller class.
    UseGuards(guard)(SupportController);
  }
  return SupportController;
}
