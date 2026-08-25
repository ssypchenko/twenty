import { Injectable, Logger } from '@nestjs/common';

import { type ObjectLiteral } from 'typeorm';

import { normalisePermaventSalesRepCode } from 'src/engine/core-modules/permavent-security/assignments/normalise-permavent-sales-rep-code.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

const PERMAVENT_ASSIGNMENT_OBJECT_NAME = 'salesrepassignment';
const PERMAVENT_ASSIGNMENT_TIME_ZONE = 'Europe/London';

type FindAllowedSalesRepCodesInput = {
  workspaceId: string;
  workspaceMemberId: string | null;
  at?: Date;
};

type PermaventSalesRepAssignmentWorkspaceRecord = ObjectLiteral & {
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
  }: FindAllowedSalesRepCodesInput): Promise<string[]> {
    if (workspaceMemberId === null) {
      return [];
    }

    const businessDate = this.formatBusinessDate(at);
    const assignments =
      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const assignmentRepository =
            await this.globalWorkspaceOrmManager.getRepository<PermaventSalesRepAssignmentWorkspaceRecord>(
              workspaceId,
              PERMAVENT_ASSIGNMENT_OBJECT_NAME,
              { shouldBypassPermissionChecks: true },
            );

          return assignmentRepository
            .createQueryBuilder('assignment')
            .select('assignment.erpSalesRepCode', 'erpSalesRepCode')
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
            )
            .orderBy('assignment.erpSalesRepCode', 'ASC')
            .getRawMany<
              Pick<
                PermaventSalesRepAssignmentWorkspaceRecord,
                'erpSalesRepCode'
              >
            >();
        },
        buildSystemAuthContext(workspaceId),
      );

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
  }: FindAllowedSalesRepCodesInput): Promise<string | null> {
    if (workspaceMemberId === null) {
      return null;
    }

    const businessDate = this.formatBusinessDate(at);

    try {
      const assignments =
        await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
          async () => {
            const assignmentRepository =
              await this.globalWorkspaceOrmManager.getRepository<PermaventSalesRepAssignmentWorkspaceRecord>(
                workspaceId,
                PERMAVENT_ASSIGNMENT_OBJECT_NAME,
                { shouldBypassPermissionChecks: true },
              );

            return assignmentRepository
              .createQueryBuilder('assignment')
              .select('assignment.erpSalesRepCode', 'erpSalesRepCode')
              .addSelect('assignment.isPrimary', 'isPrimary')
              .where('assignment.salesRepId = :workspaceMemberId', {
                workspaceMemberId,
              })
              .andWhere('assignment.deletedAt IS NULL')
              .andWhere('assignment.isActive = true')
              .andWhere('assignment.isPrimary = true')
              .andWhere(
                '(assignment.validFrom IS NULL OR assignment.validFrom <= :businessDate)',
                { businessDate },
              )
              .andWhere(
                '(assignment.validTo IS NULL OR assignment.validTo > :businessDate)',
                { businessDate },
              )
              .getRawMany<
                Pick<
                  PermaventSalesRepAssignmentWorkspaceRecord,
                  'erpSalesRepCode' | 'isPrimary'
                >
              >();
          },
          buildSystemAuthContext(workspaceId),
        );

      if (assignments.length === 0) {
        return null;
      }

      if (assignments.length !== 1) {
        this.logger.warn('Ignored an ambiguous primary Sales Rep assignment.');

        return null;
      }

      const [assignment] = assignments;

      if (assignment.erpSalesRepCode === null) {
        return null;
      }

      return normalisePermaventSalesRepCode(assignment.erpSalesRepCode);
    } catch {
      this.logger.warn('Unable to resolve the primary Sales Rep assignment.');

      return null;
    }
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
