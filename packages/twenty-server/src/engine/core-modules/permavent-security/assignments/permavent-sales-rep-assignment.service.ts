import { Injectable } from '@nestjs/common';

import { normalisePermaventAssignmentEmail } from 'src/engine/core-modules/permavent-security/assignments/normalise-permavent-assignment-email.util';
import { normalisePermaventSalesRepCode } from 'src/engine/core-modules/permavent-security/assignments/normalise-permavent-sales-rep-code.util';
import { PermaventSalesRepAssignmentEntity } from 'src/engine/core-modules/permavent-security/assignments/permavent-sales-rep-assignment.entity';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

type FindAllowedSalesRepCodesInput = {
  workspaceId: string;
  userEmail: string;
  at?: Date;
};

type UpsertSalesRepAssignmentInput = {
  workspaceId: string;
  userWorkspaceId?: string | null;
  workspaceMemberId?: string | null;
  userEmail: string;
  erpSalesRepCode: string;
  isActive?: boolean;
  validFrom?: Date | null;
  validTo?: Date | null;
};

type SetSalesRepAssignmentActiveInput = {
  workspaceId: string;
  userEmail: string;
  erpSalesRepCode: string;
  isActive: boolean;
};

@Injectable()
export class PermaventSalesRepAssignmentService {
  constructor(
    @InjectWorkspaceScopedRepository(PermaventSalesRepAssignmentEntity)
    private readonly assignmentRepository: WorkspaceScopedRepository<PermaventSalesRepAssignmentEntity>,
  ) {}

  public async findAllowedSalesRepCodes({
    workspaceId,
    userEmail,
    at = new Date(),
  }: FindAllowedSalesRepCodesInput): Promise<string[]> {
    const normalisedEmail = normalisePermaventAssignmentEmail(userEmail);

    const assignments = await this.assignmentRepository
      .createQueryBuilder('assignment')
      .select('assignment.erpSalesRepCode', 'erpSalesRepCode')
      .where('assignment.workspaceId = :workspaceId', { workspaceId })
      .andWhere('assignment.userEmail = :userEmail', {
        userEmail: normalisedEmail,
      })
      .andWhere('assignment.isActive = true')
      .andWhere(
        '(assignment.validFrom IS NULL OR assignment.validFrom <= :at)',
        { at },
      )
      .andWhere('(assignment.validTo IS NULL OR assignment.validTo > :at)', {
        at,
      })
      .orderBy('assignment.erpSalesRepCode', 'ASC')
      .getRawMany<{ erpSalesRepCode: string }>();

    return [
      ...new Set(
        assignments.map(({ erpSalesRepCode }) =>
          normalisePermaventSalesRepCode(erpSalesRepCode),
        ),
      ),
    ].sort();
  }

  public async upsertAssignment({
    workspaceId,
    userWorkspaceId = null,
    workspaceMemberId = null,
    userEmail,
    erpSalesRepCode,
    isActive = true,
    validFrom = null,
    validTo = null,
  }: UpsertSalesRepAssignmentInput): Promise<void> {
    this.assertValidValidityWindow({ validFrom, validTo });

    await this.assignmentRepository.upsert(
      workspaceId,
      {
        userWorkspaceId,
        workspaceMemberId,
        userEmail: normalisePermaventAssignmentEmail(userEmail),
        erpSalesRepCode: normalisePermaventSalesRepCode(erpSalesRepCode),
        isActive,
        validFrom,
        validTo,
      },
      {
        conflictPaths: ['workspaceId', 'userEmail', 'erpSalesRepCode'],
        skipUpdateIfNoValuesChanged: true,
      },
    );
  }

  public async setAssignmentActive({
    workspaceId,
    userEmail,
    erpSalesRepCode,
    isActive,
  }: SetSalesRepAssignmentActiveInput): Promise<boolean> {
    const result = await this.assignmentRepository.update(
      workspaceId,
      {
        userEmail: normalisePermaventAssignmentEmail(userEmail),
        erpSalesRepCode: normalisePermaventSalesRepCode(erpSalesRepCode),
      },
      { isActive },
    );

    return (result.affected ?? 0) > 0;
  }

  private assertValidValidityWindow({
    validFrom,
    validTo,
  }: {
    validFrom: Date | null;
    validTo: Date | null;
  }): void {
    if (validFrom !== null && validTo !== null && validTo <= validFrom) {
      throw new Error('The assignment end date must be after its start date.');
    }
  }
}
