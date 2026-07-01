import { DynamicModule, Module } from '@nestjs/common';
import { createSupportController } from './support.controller';
import { SupportService } from './support.service';
import {
  SUPPORT_OPTIONS,
  SupportModuleAsyncOptions,
  SupportModuleOptions,
} from './types';

/**
 * Registers GET /<route>/handoff, which mints a CIMP hand-off token for the
 * signed-in user and 302-redirects them to the CIMP reporter form.
 *
 * Use forRoot when your config is static, or forRootAsync when getUser needs an
 * injected service (e.g. Prisma/TypeORM to look up the user's name).
 */
@Module({})
export class SupportModule {
  static forRoot(options: SupportModuleOptions): DynamicModule {
    const { guard, route, ...runtime } = options;
    return {
      module: SupportModule,
      controllers: [createSupportController(guard, route)],
      providers: [
        { provide: SUPPORT_OPTIONS, useValue: runtime },
        SupportService,
      ],
      exports: [SupportService],
    };
  }

  static forRootAsync(options: SupportModuleAsyncOptions): DynamicModule {
    return {
      module: SupportModule,
      imports: options.imports ?? [],
      controllers: [createSupportController(options.guard, options.route)],
      providers: [
        {
          provide: SUPPORT_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        SupportService,
      ],
      exports: [SupportService],
    };
  }
}
