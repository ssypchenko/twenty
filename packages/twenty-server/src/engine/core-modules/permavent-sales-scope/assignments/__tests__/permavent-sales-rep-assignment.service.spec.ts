import { PermaventSalesRepAssignmentService } from 'src/engine/core-modules/permavent-sales-scope/assignments/permavent-sales-rep-assignment.service';
import { type GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-orm.manager';

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

  it('should query lower-case custom workspace fields for effective assignments', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      { erpSalesRepCode: 'RT' },
      { erpSalesRepCode: 'dm' },
      { erpSalesRepCode: 'DM' },
    ]);

    await expect(
      service.findAllowedSalesRepCodes({
        workspaceId: 'workspace-id',
        workspaceMemberId: 'workspace-member-id',
        at: new Date('2026-08-27T23:30:00.000Z'),
      }),
    ).resolves.toEqual(['DM', 'RT']);

    expect(getRepository).toHaveBeenCalledWith('salesrepassignment', {
      shouldBypassPermissionChecks: true,
    });
    expect(queryBuilder.select).toHaveBeenCalledWith(
      'assignment.erpsalesrepcode',
      'erpSalesRepCode',
    );
    expect(queryBuilder.addSelect).toHaveBeenCalledWith(
      'assignment.isprimary',
      'isPrimary',
    );
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'assignment.salesRepId = :workspaceMemberId',
      { workspaceMemberId: 'workspace-member-id' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'assignment.deletedAt IS NULL',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'assignment.isactive = true',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(assignment.validfrom IS NULL OR assignment.validfrom <= :businessDate)',
      { businessDate: '2026-08-28' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(assignment.validto IS NULL OR assignment.validto > :businessDate)',
      { businessDate: '2026-08-28' },
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith(
      'assignment.erpsalesrepcode',
      'ASC',
    );
  });

  it('should query the lower-case primary assignment field', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      { erpSalesRepCode: ' dm ', isPrimary: true },
    ]);

    await expect(
      service.findPrimarySalesRepCode({
        workspaceId: 'workspace-id',
        workspaceMemberId: 'workspace-member-id',
      }),
    ).resolves.toBe('DM');

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'assignment.isprimary = true',
    );
  });
});
