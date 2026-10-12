import { Injectable } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { isDelegatedApiKeyAuthContext } from 'src/engine/core-modules/auth/guards/is-delegated-api-key-auth-context.guard';
import { isUserAuthContext } from 'src/engine/core-modules/auth/guards/is-user-auth-context.guard';
import { PermaventSalesRepAssignmentService } from 'src/engine/core-modules/permavent-sales-scope/assignments/permavent-sales-rep-assignment.service';
import { PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS } from 'src/engine/core-modules/permavent-sales-scope/constants/permavent-role-universal-identifiers.constant';
import { type PermaventSalesScopeContext } from 'src/engine/core-modules/permavent-sales-scope/context/permavent-sales-scope-context.type';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { STANDARD_ROLE } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-role.constant';

@Injectable()
export class PermaventSalesScopeContextFactory {
  private readonly contextByAuthContext = new WeakMap<
    WorkspaceAuthContext,
    Promise<PermaventSalesScopeContext>
  >();

  constructor(
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly assignmentService: PermaventSalesRepAssignmentService,
  ) {}

  public async create(
    authContext: WorkspaceAuthContext,
  ): Promise<PermaventSalesScopeContext> {
    const cachedContext = this.contextByAuthContext.get(authContext);

    if (isDefined(cachedContext)) {
      return cachedContext;
    }

    const contextPromise = this.createContext(authContext).catch((error) => {
      this.contextByAuthContext.delete(authContext);

      throw error;
    });

    this.contextByAuthContext.set(authContext, contextPromise);

    return contextPromise;
  }

  private async createContext(
    authContext: WorkspaceAuthContext,
  ): Promise<PermaventSalesScopeContext> {
    const delegatedActor = isDelegatedApiKeyAuthContext(authContext)
      ? authContext.delegatedActor
      : undefined;
    const userContext = isUserAuthContext(authContext)
      ? authContext
      : delegatedActor;

    if (!userContext) {
      return {
        authContextType: authContext.type,
        workspaceId: null,
        workspaceMemberId: null,
        userEmail: null,
        roleUniversalIdentifier: null,
        isSalesManager: false,
        isRestrictedSalesRep: false,
        allowedSalesRepCodes: [],
        primarySalesRepCode: null,
        isSupportedUserContext: false,
      };
    }

    const { flatRoleMaps, userWorkspaceRoleMap } =
      await this.workspaceCacheService.getOrRecompute(
        authContext.workspace.id,
        ['flatRoleMaps', 'userWorkspaceRoleMap'],
      );
    const roleId = delegatedActor
      ? delegatedActor.roleId
      : userWorkspaceRoleMap[userContext.userWorkspaceId];
    const roleUniversalIdentifier = isDefined(roleId)
      ? flatRoleMaps.universalIdentifierById[roleId]
      : undefined;
    const isSalesManager =
      roleUniversalIdentifier === STANDARD_ROLE.admin.universalIdentifier ||
      roleUniversalIdentifier ===
        PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS.salesManager;
    const isRestrictedSalesRep =
      roleUniversalIdentifier === PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS.salesRep;
    const [allowedSalesRepCodes, primarySalesRepCode] = isRestrictedSalesRep
      ? await Promise.all([
          this.assignmentService.findAllowedSalesRepCodes({
            workspaceId: authContext.workspace.id,
            workspaceMemberId: userContext.workspaceMemberId,
          }),
          this.assignmentService.findPrimarySalesRepCode({
            workspaceId: authContext.workspace.id,
            workspaceMemberId: userContext.workspaceMemberId,
          }),
        ])
      : [[], null];

    return {
      authContextType: authContext.type,
      workspaceId: authContext.workspace.id,
      workspaceMemberId: userContext.workspaceMemberId,
      userEmail: userContext.user.email.trim().toLowerCase(),
      roleUniversalIdentifier: roleUniversalIdentifier ?? null,
      isSalesManager,
      isRestrictedSalesRep,
      allowedSalesRepCodes,
      primarySalesRepCode,
      isSupportedUserContext: true,
    };
  }
}
