import {
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type PermaventSecurityContextFactory } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.factory';
import { type PermaventSecurityContext } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.type';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { type GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { PermaventWeeklySalesReportSourceService } from 'src/modules/permavent-weekly-sales-report/services/permavent-weekly-sales-report-source.service';

describe('PermaventWeeklySalesReportSourceService', () => {
  const getConfig = jest.fn();
  const createSecurityContext = jest.fn();
  const query = jest.fn();
  const getReplica = jest.fn().mockResolvedValue({ query });
  const executeInWorkspaceContext = jest.fn(async (callback) => callback());
  const securityContext: PermaventSecurityContext = {
    authContextType: 'user',
    workspaceId: '20202020-0000-4000-8000-000000000001',
    workspaceMemberId: 'workspace-member-id',
    userWorkspaceId: 'user-workspace-id',
    userEmail: 'sales.rep@example.test',
    roleId: 'sales-rep-role-id',
    roleUniversalIdentifier: 'sales-rep-role-universal-identifier',
    roleLabel: 'SalesRep',
    bypassSecurity: false,
    isRestrictedSalesRep: true,
    allowedSalesRepCodes: ['DM', 'RT'],
    primarySalesRepCode: 'DM',
    isSupportedUserContext: true,
  };
  const service = new PermaventWeeklySalesReportSourceService(
    { get: getConfig } as unknown as TwentyConfigService,
    {
      create: createSecurityContext,
    } as unknown as PermaventSecurityContextFactory,
    {
      executeInWorkspaceContext,
      getGlobalWorkspaceDataSourceReplica: getReplica,
    } as unknown as GlobalWorkspaceOrmManager,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    getConfig.mockReturnValue(true);
    createSecurityContext.mockResolvedValue(securityContext);
    getReplica.mockResolvedValue({ query });
    query.mockResolvedValue([
      {
        actorMessageCount: '2',
        entityCount: '2',
        internalMessageCount: '1',
        qualifiedMessageCount: '1',
        multiEntityMessageCount: '0',
        multiEntityNoteCount: '0',
        noteCount: '1',
        unlinkedMessageCount: '1',
        unlinkedNoteCount: '1',
        messages: [
          {
            id: 'message-id',
            messageThreadId: 'thread-id',
            subject: 'Order follow-up',
            body: 'Sanitised body',
            receivedAt: '2026-07-29T09:00:00.000Z',
            entities: [
              {
                entityType: 'BRANCH',
                id: 'branch-id',
                name: 'Example Branch',
              },
            ],
            participants: [],
          },
        ],
        internalMessages: [
          {
            id: 'internal-message-id',
            messageThreadId: 'internal-thread-id',
            subject: 'Internal planning',
            body: 'Sanitised body',
            receivedAt: '2026-07-30T09:00:00.000Z',
            entities: [],
            participants: [],
          },
        ],
        unlinkedMessages: [
          {
            id: 'unlinked-message-id',
            messageThreadId: 'unlinked-thread-id',
            subject: 'Unlinked subject',
            body: null,
            receivedAt: '2026-07-30T09:00:00.000Z',
            participants: [],
            reason: 'PERSON_WITHOUT_ENTITY',
          },
        ],
        notes: [
          {
            id: 'note-id',
            title: 'Site visit',
            body: 'Sanitised note',
            createdAt: '2026-07-31T10:00:00.000Z',
            entities: [
              {
                entityType: 'BRANCH',
                id: 'branch-id',
                name: 'Example Branch',
              },
            ],
          },
        ],
        unlinkedNotes: [
          {
            id: 'unlinked-note-id',
            title: 'Follow-up',
            body: null,
            createdAt: '2026-07-31T11:00:00.000Z',
            reason: 'NO_ENTITY',
          },
        ],
      },
    ]);
  });

  it('returns scoped messages and London period metadata', async () => {
    const generatedAt = new Date('2026-08-01T10:30:00.000Z');

    await expect(
      service.getSource({
        authContext: {} as WorkspaceAuthContext,
        includeBody: true,
        generatedAt,
      }),
    ).resolves.toMatchObject({
      actorWorkspaceMemberId: 'workspace-member-id',
      period: {
        start: '2026-07-26T23:00:00.000Z',
        generatedAt: '2026-08-01T10:30:00.000Z',
        timeZone: 'Europe/London',
      },
      scope: { activeTerritoryCount: 2, entityCount: 2 },
      stats: {
        internalMessageCount: 1,
        messageCount: 1,
        multiEntityMessageCount: 0,
        multiEntityNoteCount: 0,
        noteCount: 1,
        unlinkedMessageCount: 1,
        unlinkedNoteCount: 1,
      },
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WITH week_message AS'),
      [
        'workspace-member-id',
        new Date('2026-07-26T23:00:00.000Z'),
        generatedAt,
        true,
        1001,
      ],
      undefined,
      { shouldBypassPermissionChecks: true },
    );
    const sourceQuery = query.mock.calls[0][0];
    expect(sourceQuery).toContain('week_note AS');
    expect(sourceQuery).toContain('"noteTarget"');
    expect(sourceQuery).toContain('actor_message AS');
    expect(sourceQuery).toContain('message."receivedAt" >= $2');
    expect(sourceQuery).toContain('message."receivedAt" <= $3');
    expect(sourceQuery).toContain('CASE WHEN $4::boolean');
    expect(sourceQuery).toContain('LIMIT $5');
    expect(sourceQuery).not.toMatch(/\$6\b/u);
    expect(sourceQuery).toContain('"targetBranchId"');
    expect(sourceQuery).toContain('"_branch" AS branch');
    expect(sourceQuery).toContain('internal_message AS');
    expect(sourceQuery).toContain(
      "participant.role IN ('FROM', 'TO', 'CC', 'BCC')",
    );
    expect(sourceQuery).not.toContain('scoped_company AS');
  });

  it('does not query when the feature is disabled', async () => {
    getConfig.mockReturnValue(false);

    await expect(
      service.getSource({
        authContext: {} as WorkspaceAuthContext,
        includeBody: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(query).not.toHaveBeenCalled();
  });

  it('does not query for a user who is not a Sales Rep', async () => {
    createSecurityContext.mockResolvedValue({
      ...securityContext,
      isRestrictedSalesRep: false,
    });

    await expect(
      service.getSource({
        authContext: {} as WorkspaceAuthContext,
        includeBody: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects a source that exceeds the processing limit', async () => {
    query.mockResolvedValue([
      {
        actorMessageCount: 1001,
        entityCount: 0,
        internalMessageCount: 0,
        qualifiedMessageCount: 1001,
        multiEntityMessageCount: 0,
        multiEntityNoteCount: 0,
        noteCount: 1,
        unlinkedMessageCount: 0,
        unlinkedNoteCount: 0,
        messages: [],
        internalMessages: [],
        notes: [],
        unlinkedMessages: [],
        unlinkedNotes: [],
      },
    ]);

    await expect(
      service.getSource({
        authContext: {} as WorkspaceAuthContext,
        includeBody: false,
      }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });
});
