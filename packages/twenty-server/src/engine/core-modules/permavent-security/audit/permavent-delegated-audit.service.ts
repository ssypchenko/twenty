import { Injectable, Logger } from '@nestjs/common';

import { isDelegatedApiKeyAuthContext } from 'src/engine/core-modules/auth/guards/is-delegated-api-key-auth-context.guard';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';

type DelegatedAuditResult = 'allowed' | 'denied';

@Injectable()
export class PermaventDelegatedAuditService {
  private readonly logger = new Logger(PermaventDelegatedAuditService.name);

  public recordOperation({
    authContext,
    operation,
    objectName,
    result,
    denialCategory,
  }: {
    authContext: WorkspaceAuthContext;
    operation: string;
    objectName: string;
    result: DelegatedAuditResult;
    denialCategory?: string;
  }): void {
    if (!isDelegatedApiKeyAuthContext(authContext)) {
      return;
    }

    this.safeLog('log', {
      event: 'permavent.delegated_api_context',
      apiKeyPrincipalId: authContext.apiKey.id,
      actorWorkspaceMemberId: authContext.delegatedActor.workspaceMemberId,
      actorRoleUniversalIdentifier:
        authContext.delegatedActor.roleUniversalIdentifier,
      workspaceId: authContext.workspace.id,
      operation,
      objectName,
      result,
      denialCategory,
      correlationId: authContext.delegatedActor.correlationId,
    });
  }

  public recordResolutionDenied({
    apiKeyPrincipalId,
    workspaceId,
    denialCategory,
  }: {
    apiKeyPrincipalId?: string;
    workspaceId?: string;
    denialCategory: string;
  }): void {
    this.safeLog('warn', {
      event: 'permavent.delegated_api_context',
      apiKeyPrincipalId,
      workspaceId,
      result: 'denied',
      denialCategory,
    });
  }

  private safeLog(
    method: 'log' | 'warn',
    event: Record<string, string | undefined>,
  ): void {
    try {
      this.logger[method](JSON.stringify(event));
    } catch {
      // Audit failures must not alter authorisation decisions or API responses.
    }
  }
}
