import { Logger } from '@nestjs/common';

import { normalisePermaventSalesRepCode } from 'src/engine/core-modules/permavent-security/assignments/normalise-permavent-sales-rep-code.util';
import { PermaventSalesRepAssignmentService } from 'src/engine/core-modules/permavent-security/assignments/permavent-sales-rep-assignment.service';
import { type GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';

describe('PermaventSalesRepAssignmentService', () => {
  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const getRepository = jest.fn().mockResolvedValue({
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
  });
  const executeInWorkspaceContext = jest
    .fn()
    .mockImplementation((callback) => callback());
  const service = new PermaventSalesRepAssignmentService({
    getRepository,
    executeInWorkspaceContext,
  } as unknown as GlobalWorkspaceOrmManager);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return effective Sales Rep codes in canonical order', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      { erpSalesRepCode: 'RT' },
      { erpSalesRepCode: 'dm' },
      { erpSalesRepCode: 'DM' },
      { erpSalesRepCode: 'scotland' },
      { erpSalesRepCode: null },
    ]);

    const result = await service.findAllowedSalesRepCodes({
      workspaceId: 'workspace-id',
      workspaceMemberId: 'workspace-member-id',
      at: new Date('2026-07-12T23:30:00.000Z'),
    });

    expect(result).toEqual(['DM', 'RT', 'SCOTLAND']);
    expect(executeInWorkspaceContext).toHaveBeenCalledWith(
      expect.any(Function),
      {
        type: 'system',
        workspace: { id: 'workspace-id' },
      },
    );
    expect(getRepository).toHaveBeenCalledWith(
      'workspace-id',
      'salesrepassignment',
      { shouldBypassPermissionChecks: true },
    );
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'assignment.salesRepId = :workspaceMemberId',
      { workspaceMemberId: 'workspace-member-id' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'assignment.deletedAt IS NULL',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'assignment.isActive = true',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(assignment.validFrom IS NULL OR assignment.validFrom <= :businessDate)',
      { businessDate: '2026-07-13' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(assignment.validTo IS NULL OR assignment.validTo > :businessDate)',
      { businessDate: '2026-07-13' },
    );
  });

  it('should fail closed without a Workspace Member identity', async () => {
    const result = await service.findAllowedSalesRepCodes({
      workspaceId: 'workspace-id',
      workspaceMemberId: null,
    });

    expect(result).toEqual([]);
    expect(executeInWorkspaceContext).not.toHaveBeenCalled();
    expect(getRepository).not.toHaveBeenCalled();
  });

  it('should ignore an invalid CRM assignment code', async () => {
    const loggerWarning = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation();

    queryBuilder.getRawMany.mockResolvedValue([
      { erpSalesRepCode: 'DM' },
      { erpSalesRepCode: 'REP1' },
    ]);

    const result = await service.findAllowedSalesRepCodes({
      workspaceId: 'workspace-id',
      workspaceMemberId: 'workspace-member-id',
    });

    expect(result).toEqual(['DM']);
    expect(loggerWarning).toHaveBeenCalledWith(
      'Ignored an invalid Sales Rep assignment code.',
    );

    loggerWarning.mockRestore();
  });

  it('should return the one effective primary Sales Rep code', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      { erpSalesRepCode: ' dm ', isPrimary: true },
    ]);

    await expect(
      service.findPrimarySalesRepCode({
        workspaceId: 'workspace-id',
        workspaceMemberId: 'workspace-member-id',
        at: new Date('2026-07-12T23:30:00.000Z'),
      }),
    ).resolves.toBe('DM');

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'assignment.isPrimary = true',
    );
  });

  it('should fail closed when more than one primary assignment is effective', async () => {
    const loggerWarning = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation();
    queryBuilder.getRawMany.mockResolvedValue([
      { erpSalesRepCode: 'DM', isPrimary: true },
      { erpSalesRepCode: 'RT', isPrimary: true },
    ]);

    await expect(
      service.findPrimarySalesRepCode({
        workspaceId: 'workspace-id',
        workspaceMemberId: 'workspace-member-id',
      }),
    ).resolves.toBeNull();
    expect(loggerWarning).toHaveBeenCalledWith(
      'Ignored an ambiguous primary Sales Rep assignment.',
    );

    loggerWarning.mockRestore();
  });

  it('should fail closed when the primary field is unavailable', async () => {
    const loggerWarning = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation();
    queryBuilder.getRawMany.mockRejectedValue(new Error('field unavailable'));

    await expect(
      service.findPrimarySalesRepCode({
        workspaceId: 'workspace-id',
        workspaceMemberId: 'workspace-member-id',
      }),
    ).resolves.toBeNull();
    expect(loggerWarning).toHaveBeenCalledWith(
      'Unable to resolve the primary Sales Rep assignment.',
    );

    loggerWarning.mockRestore();
  });

  it.each([
    ['dm', 'DM'],
    [' NSR ', 'NSR'],
    ['scotland', 'SCOTLAND'],
    ['A'.repeat(32), 'A'.repeat(32)],
  ])(
    'should canonicalise supported territory identifier %s',
    (input, expected) => {
      expect(normalisePermaventSalesRepCode(input)).toBe(expected);
    },
  );

  it.each(['A', 'A'.repeat(33), 'NORTH-WEST', 'NORTH WEST', 'REP1'])(
    'should reject unsupported territory identifier %s',
    (input) => {
      expect(() => normalisePermaventSalesRepCode(input)).toThrow(
        'A Sales Rep code must contain between two and 32 uppercase letters.',
      );
    },
  );
});
