import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { buildHandoffUrl, HandoffUser, mintHandoffToken } from '../core';
import { SUPPORT_OPTIONS, SupportRuntimeOptions } from './types';

@Injectable()
export class SupportService {
  constructor(
    @Inject(SUPPORT_OPTIONS) private readonly options: SupportRuntimeOptions,
  ) {}

  /**
   * Mint a hand-off token for the current request's user and return the CIMP
   * reporter URL to redirect them to.
   */
  async handoffUrlForRequest(req: any): Promise<string> {
    const { platformKey, handoffSecret, baseUrl } = this.options;
    if (!platformKey || !handoffSecret || !baseUrl) {
      throw new ServiceUnavailableException(
        'cimp-connect is not configured (platformKey, handoffSecret and baseUrl are required).',
      );
    }

    const user: HandoffUser = await this.options.getUser(req);
    const token = mintHandoffToken({
      platformKey,
      secret: handoffSecret,
      user,
      expiresIn: this.options.expiresIn,
    });
    return buildHandoffUrl(baseUrl, token, this.options.reporterPath);
  }
}
