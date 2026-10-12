import { Injectable } from '@nestjs/common';

import {
  type PermaventLogicFunctionActorContext,
  type PermaventSalesScope,
} from 'twenty-shared/types';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { PermaventSalesScopeContextFactory } from 'src/engine/core-modules/permavent-sales-scope/context/permavent-sales-scope-context.factory';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

@Injectable()
export class PermaventSalesScopeService {
  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly salesScopeContextFactory: PermaventSalesScopeContextFactory,
  ) {}

  public async resolveErpSalesScope(
    authContext: WorkspaceAuthContext,
  ): Promise<PermaventSalesScope> {
    if (!this.twentyConfigService.get('PERMAVENT_ERP_SALES_SCOPE_ENABLED')) {
      return { mode: 'NONE', salesRepCodes: [] };
    }

    const context = await this.salesScopeContextFactory.create(authContext);

    if (!context.isSupportedUserContext) {
      return { mode: 'NONE', salesRepCodes: [] };
    }

    if (context.isSalesManager) {
      return { mode: 'ALL', salesRepCodes: [] };
    }

    if (
      !context.isRestrictedSalesRep ||
      context.allowedSalesRepCodes.length === 0
    ) {
      return { mode: 'NONE', salesRepCodes: [] };
    }

    return {
      mode: 'ASSIGNED',
      salesRepCodes: [...context.allowedSalesRepCodes].sort(),
      primarySalesRepCode: context.primarySalesRepCode,
    };
  }

  public async resolveLogicFunctionActorContext(
    authContext: WorkspaceAuthContext,
  ): Promise<PermaventLogicFunctionActorContext | null> {
    if (
      !this.twentyConfigService.get('PERMAVENT_WEEKLY_SALES_REPORT_ENABLED')
    ) {
      return null;
    }

    const context = await this.salesScopeContextFactory.create(authContext);

    if (
      !context.isSupportedUserContext ||
      context.workspaceMemberId === null ||
      context.userEmail === null
    ) {
      return null;
    }

    return {
      workspaceMemberId: context.workspaceMemberId,
      userEmail: context.userEmail,
      roleUniversalIdentifier: context.roleUniversalIdentifier,
      isRestrictedSalesRep: context.isRestrictedSalesRep,
    };
  }
}
