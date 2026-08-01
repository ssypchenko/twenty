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
        companyCount: '12',
        peopleCount: '30',
        qualifiedMessageCount: '1',
        multiCompanyMessageCount: '0',
        unlinkedMessageCount: '1',
        messages: [
          {
            id: 'message-id',
            messageThreadId: 'thread-id',
            subject: 'Order follow-up',
            body: 'Sanitised body',
            receivedAt: '2026-07-29T09:00:00.000Z',
            companies: [{ id: 'company-id', name: 'Example Company' }],
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
            reason: 'NO_PERSON',
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
      scope: { activeTerritoryCount: 2, companyCount: 12, peopleCount: 30 },
      stats: {
        messageCount: 1,
        multiCompanyMessageCount: 0,
        unlinkedMessageCount: 1,
      },
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WITH scoped_company AS'),
      [
        'workspace-member-id',
        ['DM', 'RT'],
        new Date('2026-07-26T23:00:00.000Z'),
        generatedAt,
        true,
        1001,
      ],
      undefined,
      { shouldBypassPermissionChecks: true },
    );
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
        companyCount: 12,
        peopleCount: 30,
        qualifiedMessageCount: 1001,
        multiCompanyMessageCount: 0,
        unlinkedMessageCount: 0,
        messages: [],
        unlinkedMessages: [],
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
