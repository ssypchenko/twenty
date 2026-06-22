import { PermaventSalesRepAssignmentEntity } from 'src/engine/core-modules/permavent-security/assignments/permavent-sales-rep-assignment.entity';
import { PermaventSalesRepAssignmentService } from 'src/engine/core-modules/permavent-security/assignments/permavent-sales-rep-assignment.service';
import { type WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

describe('PermaventSalesRepAssignmentService', () => {
  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const assignmentRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    upsert: jest.fn(),
    update: jest.fn(),
  };
  const service = new PermaventSalesRepAssignmentService(
    assignmentRepository as unknown as WorkspaceScopedRepository<PermaventSalesRepAssignmentEntity>,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return active Sales Rep codes in canonical order', async () => {
    const at = new Date('2026-06-22T10:00:00.000Z');

    queryBuilder.getRawMany.mockResolvedValue([
      { erpSalesRepCode: 'RT' },
      { erpSalesRepCode: 'dm' },
      { erpSalesRepCode: 'DM' },
    ]);

    const result = await service.findAllowedSalesRepCodes({
      workspaceId: 'workspace-id',
      userEmail: ' Sales.Rep@Example.test ',
      at,
    });

    expect(result).toEqual(['DM', 'RT']);
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'assignment.workspaceId = :workspaceId',
      { workspaceId: 'workspace-id' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'assignment.userEmail = :userEmail',
      { userEmail: 'sales.rep@example.test' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(assignment.validFrom IS NULL OR assignment.validFrom <= :at)',
      { at },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(assignment.validTo IS NULL OR assignment.validTo > :at)',
      { at },
    );
  });

  it('should normalise an assignment before persisting it', async () => {
    await service.upsertAssignment({
      workspaceId: 'workspace-id',
      userWorkspaceId: 'user-workspace-id',
      workspaceMemberId: 'workspace-member-id',
      userEmail: ' Sales.Rep@Example.test ',
      erpSalesRepCode: ' rt ',
    });

    expect(assignmentRepository.upsert).toHaveBeenCalledWith(
      'workspace-id',
      {
        userWorkspaceId: 'user-workspace-id',
        workspaceMemberId: 'workspace-member-id',
        userEmail: 'sales.rep@example.test',
        erpSalesRepCode: 'RT',
        isActive: true,
        validFrom: null,
        validTo: null,
      },
      {
        conflictPaths: ['workspaceId', 'userEmail', 'erpSalesRepCode'],
        skipUpdateIfNoValuesChanged: true,
      },
    );
  });

  it('should reject an invalid Sales Rep code', async () => {
    await expect(
      service.upsertAssignment({
        workspaceId: 'workspace-id',
        userEmail: 'sales.rep@example.test',
        erpSalesRepCode: 'REP1',
      }),
    ).rejects.toThrow(
      'A Sales Rep code must contain two or three uppercase letters.',
    );
    expect(assignmentRepository.upsert).not.toHaveBeenCalled();
  });

  it('should reject an invalid validity window', async () => {
    await expect(
      service.upsertAssignment({
        workspaceId: 'workspace-id',
        userEmail: 'sales.rep@example.test',
        erpSalesRepCode: 'DM',
        validFrom: new Date('2026-06-23T00:00:00.000Z'),
        validTo: new Date('2026-06-22T00:00:00.000Z'),
      }),
    ).rejects.toThrow('The assignment end date must be after its start date.');
    expect(assignmentRepository.upsert).not.toHaveBeenCalled();
  });

  it('should report whether an assignment was updated', async () => {
    assignmentRepository.update.mockResolvedValue({ affected: 1 });

    const result = await service.setAssignmentActive({
      workspaceId: 'workspace-id',
      userEmail: ' Sales.Rep@Example.test ',
      erpSalesRepCode: ' dm ',
      isActive: false,
    });

    expect(result).toBe(true);
    expect(assignmentRepository.update).toHaveBeenCalledWith(
      'workspace-id',
      {
        userEmail: 'sales.rep@example.test',
        erpSalesRepCode: 'DM',
      },
      { isActive: false },
    );
  });
});
