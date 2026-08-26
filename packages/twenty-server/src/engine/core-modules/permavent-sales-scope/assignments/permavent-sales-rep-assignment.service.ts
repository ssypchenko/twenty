import { Injectable, Logger } from '@nestjs/common';

import { type ObjectLiteral } from 'typeorm';

import { normalisePermaventSalesRepCode } from 'src/engine/core-modules/permavent-sales-scope/assignments/normalise-permavent-sales-rep-code.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

const PERMAVENT_ASSIGNMENT_OBJECT_NAME = 'salesrepassignment';
const PERMAVENT_ASSIGNMENT_TIME_ZONE = 'Europe/London';

type FindSalesRepAssignmentsInput = {
  workspaceId: string;
  workspaceMemberId: string | null;
  at?: Date;
};

type PermaventSalesRepAssignmentRecord = ObjectLiteral & {
  erpSalesRepCode: string | null;
  isPrimary: boolean | null;
};

@Injectable()
export class PermaventSalesRepAssignmentService {
  private readonly logger = new Logger(PermaventSalesRepAssignmentService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  public async findAllowedSalesRepCodes({
    workspaceId,
    workspaceMemberId,
    at = new Date(),
  }: FindSalesRepAssignmentsInput): Promise<string[]> {
    if (workspaceMemberId === null) {
      return [];
    }

    const assignments = await this.findActiveAssignments({
      workspaceId,
      workspaceMemberId,
      at,
    });
    const allowedSalesRepCodes = new Set<string>();

    for (const { erpSalesRepCode } of assignments) {
      if (erpSalesRepCode === null) {
        continue;
      }

      try {
        allowedSalesRepCodes.add(
          normalisePermaventSalesRepCode(erpSalesRepCode),
        );
      } catch {
        this.logger.warn('Ignored an invalid Sales Rep assignment code.');
      }
    }

    return [...allowedSalesRepCodes].sort();
  }

  public async findPrimarySalesRepCode({
    workspaceId,
    workspaceMemberId,
    at = new Date(),
  }: FindSalesRepAssignmentsInput): Promise<string | null> {
    if (workspaceMemberId === null) {
      return null;
    }

    try {
      const assignments = await this.findActiveAssignments({
        workspaceId,
        workspaceMemberId,
        at,
        isPrimary: true,
      });

      if (assignments.length !== 1) {
        if (assignments.length > 1) {
          this.logger.warn(
            'Ignored an ambiguous primary Sales Rep assignment.',
          );
        }

        return null;
      }

      const [assignment] = assignments;

      return assignment.erpSalesRepCode === null
        ? null
        : normalisePermaventSalesRepCode(assignment.erpSalesRepCode);
    } catch {
      this.logger.warn('Unable to resolve the primary Sales Rep assignment.');

      return null;
    }
  }

  private async findActiveAssignments({
    workspaceId,
    workspaceMemberId,
    at = new Date(),
    isPrimary,
  }: FindSalesRepAssignmentsInput & { isPrimary?: boolean }): Promise<
    PermaventSalesRepAssignmentRecord[]
  > {
    const businessDate = this.formatBusinessDate(at);

    return await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const assignmentRepository =
          await this.globalWorkspaceOrmManager.getRepository<PermaventSalesRepAssignmentRecord>(
            PERMAVENT_ASSIGNMENT_OBJECT_NAME,
            { shouldBypassPermissionChecks: true },
          );
        const queryBuilder = assignmentRepository
          .createQueryBuilder('assignment')
          .select('assignment.erpSalesRepCode', 'erpSalesRepCode')
          .addSelect('assignment.isPrimary', 'isPrimary')
          .where('assignment.salesRepId = :workspaceMemberId', {
            workspaceMemberId,
          })
          .andWhere('assignment.deletedAt IS NULL')
          .andWhere('assignment.isActive = true')
          .andWhere(
            '(assignment.validFrom IS NULL OR assignment.validFrom <= :businessDate)',
            { businessDate },
          )
          .andWhere(
            '(assignment.validTo IS NULL OR assignment.validTo > :businessDate)',
            { businessDate },
          );

        if (isPrimary) {
          queryBuilder.andWhere('assignment.isPrimary = true');
        }

        return await queryBuilder
          .orderBy('assignment.erpSalesRepCode', 'ASC')
          .getRawMany<PermaventSalesRepAssignmentRecord>();
      },
      buildSystemAuthContext(workspaceId),
    );
  }

  private formatBusinessDate(at: Date): string {
    const dateParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: PERMAVENT_ASSIGNMENT_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(at);
    const getPart = (type: Intl.DateTimeFormatPartTypes) =>
      dateParts.find((part) => part.type === type)?.value;

    return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  }
}
