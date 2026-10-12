import {
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type PermaventSalesScopeContextFactory } from 'src/engine/core-modules/permavent-sales-scope/context/permavent-sales-scope-context.factory';
import { type PermaventSalesScopeContext } from 'src/engine/core-modules/permavent-sales-scope/context/permavent-sales-scope-context.type';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { type WorkspaceDataSourceService } from 'src/engine/twenty-orm/datasource/workspace-data-source.service';
import { type GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-orm.manager';
import { PermaventWeeklySalesReportSourceService } from 'src/modules/permavent-weekly-sales-report/services/permavent-weekly-sales-report-source.service';

describe('PermaventWeeklySalesReportSourceService', () => {
  const getConfig = jest.fn();
  const createSalesScopeContext = jest.fn();
  const executeRawQuery = jest.fn();
  const transaction = jest.fn(async (callback) =>
    callback({ executeRawQuery }),
  );
  const getDataSource = jest.fn().mockReturnValue({ transaction });
  const executeInWorkspaceContext = jest.fn(async (callback) => callback());
  const salesScopeContext: PermaventSalesScopeContext = {
    authContextType: 'user',
    workspaceId: '20202020-0000-4000-8000-000000000001',
    workspaceMemberId: 'workspace-member-id',
    userEmail: 'sales.rep@example.test',
    roleUniversalIdentifier: 'sales-rep-role-universal-identifier',
    isSalesManager: false,
    isRestrictedSalesRep: true,
    allowedSalesRepCodes: ['DM', 'RT'],
    primarySalesRepCode: 'DM',
    isSupportedUserContext: true,
  };
  const service = new PermaventWeeklySalesReportSourceService(
    { get: getConfig } as unknown as TwentyConfigService,
    {
      create: createSalesScopeContext,
    } as unknown as PermaventSalesScopeContextFactory,
    {
      executeInWorkspaceContext,
    } as unknown as GlobalWorkspaceOrmManager,
    { getDataSource } as unknown as WorkspaceDataSourceService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    getConfig.mockReturnValue(true);
    createSalesScopeContext.mockResolvedValue(salesScopeContext);
    getDataSource.mockReturnValue({ transaction });
    executeRawQuery.mockResolvedValue([
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
    expect(executeRawQuery).toHaveBeenCalledWith(
      expect.stringContaining('WITH week_message AS'),
      [
        'workspace-member-id',
        new Date('2026-07-26T23:00:00.000Z'),
        generatedAt,
        true,
        1001,
      ],
    );
    expect(getDataSource).toHaveBeenCalledWith({ useReplica: true });
    const sourceQuery = executeRawQuery.mock.calls[0][0];
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
    expect(executeRawQuery).not.toHaveBeenCalled();
  });

  it('does not query for a user who is not a Sales Rep', async () => {
    createSalesScopeContext.mockResolvedValue({
      ...salesScopeContext,
      isRestrictedSalesRep: false,
    });

    await expect(
      service.getSource({
        authContext: {} as WorkspaceAuthContext,
        includeBody: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(executeRawQuery).not.toHaveBeenCalled();
  });

  it('rejects a source that exceeds the processing limit', async () => {
    executeRawQuery.mockResolvedValue([
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
