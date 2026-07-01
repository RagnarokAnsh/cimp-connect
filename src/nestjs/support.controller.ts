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

/** Minimal structural type for the express-style response (no express dep). */
interface RedirectResponse {
  redirect(url: string): void;
}

/**
 * Builds the /support controller at module-definition time so the consumer's
 * auth guard (a runtime class) can be applied to the route. A logged-in user
 * hits GET /<route>/handoff; we mint a token and 302-redirect to CIMP.
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
      res.redirect(url);
    }
  }

  if (guard) {
    // Apply the consumer's guard to the generated controller class.
    UseGuards(guard)(SupportController);
  }
  return SupportController;
}
