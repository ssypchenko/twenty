import { Injectable } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { isUserAuthContext } from 'src/engine/core-modules/auth/guards/is-user-auth-context.guard';
import { isDelegatedApiKeyAuthContext } from 'src/engine/core-modules/auth/guards/is-delegated-api-key-auth-context.guard';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { normalisePermaventAssignmentEmail } from 'src/engine/core-modules/permavent-security/assignments/normalise-permavent-assignment-email.util';
import { PermaventSalesRepAssignmentService } from 'src/engine/core-modules/permavent-security/assignments/permavent-sales-rep-assignment.service';
import { PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS } from 'src/engine/core-modules/permavent-security/constants/permavent-role-universal-identifiers.constant';
import { type PermaventSecurityContext } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.type';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { STANDARD_ROLE } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-role.constant';

@Injectable()
export class PermaventSecurityContextFactory {
  private readonly contextByAuthContext = new WeakMap<
    WorkspaceAuthContext,
    Promise<PermaventSecurityContext>
  >();

  constructor(
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly assignmentService: PermaventSalesRepAssignmentService,
  ) {}

  public async create(
    authContext: WorkspaceAuthContext,
  ): Promise<PermaventSecurityContext> {
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
  ): Promise<PermaventSecurityContext> {
    const delegatedActor = isDelegatedApiKeyAuthContext(authContext)
      ? authContext.delegatedActor
      : undefined;
    const userContext = isUserAuthContext(authContext)
      ? authContext
      : delegatedActor;

    if (!userContext) {
      return {
        authContextType: authContext.type,
        workspaceId: authContext.workspace?.id ?? null,
        workspaceMemberId: null,
        userWorkspaceId: null,
        userEmail: null,
        roleId: null,
        roleUniversalIdentifier: null,
        roleLabel: null,
        bypassSecurity: false,
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
    const role = isDefined(roleUniversalIdentifier)
      ? flatRoleMaps.byUniversalIdentifier[roleUniversalIdentifier]
      : undefined;
    const userEmail = normalisePermaventAssignmentEmail(userContext.user.email);
    const bypassSecurity =
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
      userWorkspaceId: userContext.userWorkspaceId,
      userEmail,
      roleId: roleId ?? null,
      roleUniversalIdentifier: roleUniversalIdentifier ?? null,
      roleLabel: role?.label ?? null,
      bypassSecurity,
      isRestrictedSalesRep,
      allowedSalesRepCodes,
      primarySalesRepCode,
      isSupportedUserContext: true,
    };
  }
}
