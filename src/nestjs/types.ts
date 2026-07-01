import type { CanActivate, ModuleMetadata, Type } from '@nestjs/common';
import type { HandoffUser } from '../core';

/** DI token holding the resolved SupportModule configuration. */
export const SUPPORT_OPTIONS = Symbol('CIMP_SUPPORT_OPTIONS');

/** The runtime config the SupportService needs to mint + redirect. */
export interface SupportRuntimeOptions {
  /** Platform key registered in CIMP. */
  platformKey: string;
  /** Per-platform hand-off signing secret from CIMP (server-side only). */
  handoffSecret: string;
  /** CIMP base URL, e.g. https://support.example.com */
  baseUrl: string;
  /**
   * Extract the reporter identity from the (already-authenticated) request.
   * This is the one project-specific adapter — return { id, name, email }.
   * May be async (e.g. a DB lookup for the user's name).
   */
  getUser: (req: any) => HandoffUser | Promise<HandoffUser>;
  /** Reporter path on CIMP. Default '/reporter/new'. */
  reporterPath?: string;
  /** Token lifetime. Default '5m'. */
  expiresIn?: string | number;
}

/** Config that shapes the controller itself (needed at module-definition time). */
export interface SupportControllerOptions {
  /**
   * Your app's auth guard, applied to GET /<route>/handoff so only
   * authenticated users can mint a token. Omit to leave the route unguarded
   * (not recommended).
   */
  guard?: Type<CanActivate>;
  /** Controller route segment. Default 'support' → GET /support/handoff. */
  route?: string;
}

export interface SupportModuleOptions
  extends SupportRuntimeOptions,
    SupportControllerOptions {}

export interface SupportModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'>,
    SupportControllerOptions {
  inject?: any[];
  useFactory: (
    ...args: any[]
  ) => SupportRuntimeOptions | Promise<SupportRuntimeOptions>;
}
