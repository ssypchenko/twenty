import { Logger } from '@nestjs/common';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { PermaventDelegatedAuditService } from 'src/engine/core-modules/permavent-security/audit/permavent-delegated-audit.service';

describe('PermaventDelegatedAuditService', () => {
  const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

  beforeEach(() => {
    log.mockClear();
  });

  afterAll(() => {
    log.mockRestore();
  });

  it('should record only the redacted delegated event contract', () => {
    const service = new PermaventDelegatedAuditService();

    service.recordOperation({
      authContext: {
        type: 'apiKey',
        workspace: { id: 'workspace-id' },
        apiKey: { id: 'api-key-id' },
        delegatedActor: {
          user: {
            id: 'user-id',
            email: 'sales.rep@example.test',
          },
          userWorkspaceId: 'user-workspace-id',
          workspaceMemberId: 'workspace-member-id',
          workspaceMember: { id: 'workspace-member-id' },
          roleId: 'role-id',
          roleUniversalIdentifier: 'sales-rep-role',
          correlationId: 'correlation-id',
        },
      } as unknown as WorkspaceAuthContext,
      operation: 'createOne',
      objectName: 'company',
      result: 'allowed',
    });

    const event = JSON.parse(log.mock.calls[0][0] as string);

    expect(event).toEqual({
      event: 'permavent.delegated_api_context',
      apiKeyPrincipalId: 'api-key-id',
      actorWorkspaceMemberId: 'workspace-member-id',
      actorRoleUniversalIdentifier: 'sales-rep-role',
      workspaceId: 'workspace-id',
      operation: 'createOne',
      objectName: 'company',
      result: 'allowed',
      correlationId: 'correlation-id',
    });
    expect(JSON.stringify(event)).not.toContain('sales.rep@example.test');
    expect(JSON.stringify(event)).not.toContain('userWorkspaceId');
  });

  it('should not record an ordinary API key request', () => {
    const service = new PermaventDelegatedAuditService();

    service.recordOperation({
      authContext: {
        type: 'apiKey',
        workspace: { id: 'workspace-id' },
        apiKey: { id: 'api-key-id' },
      } as unknown as WorkspaceAuthContext,
      operation: 'findMany',
      objectName: 'company',
      result: 'allowed',
    });

    expect(log).not.toHaveBeenCalled();
  });
});
