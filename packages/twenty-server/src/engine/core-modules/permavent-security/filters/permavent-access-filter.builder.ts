import { Injectable } from '@nestjs/common';

import { type ObjectRecordFilter } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';
import { type PermaventSecurityContext } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.type';

@Injectable()
export class PermaventAccessFilterBuilder {
  public buildCompanyOrBranchFilter(
    context: PermaventSecurityContext,
  ): ObjectRecordFilter {
    return this.buildDirectOwnershipFilter(context);
  }

  public buildRelatedCompanyOrBranchFilter(
    context: PermaventSecurityContext,
  ): ObjectRecordFilter {
    return {
      or: [
        {
          and: [
            { branchId: { is: 'NULL' } },
            { company: this.buildDirectOwnershipFilter(context) },
          ],
        },
        {
          and: [
            { branchId: { is: 'NOT_NULL' } },
            { branch: this.buildDirectOwnershipFilter(context) },
          ],
        },
      ],
    };
  }

  private buildDirectOwnershipFilter({
    workspaceMemberId,
    allowedSalesRepCodes,
  }: PermaventSecurityContext): ObjectRecordFilter {
    const ownershipConditions: ObjectRecordFilter[] = [];

    if (allowedSalesRepCodes.length > 0) {
      ownershipConditions.push({
        erpsalesrepcode: { in: allowedSalesRepCodes },
      });
    }

    if (workspaceMemberId !== null) {
      ownershipConditions.push({
        and: [
          { erpsalesrepcode: { is: 'NULL' } },
          { accountOwnerId: { eq: workspaceMemberId } },
        ],
      });
    }

    if (ownershipConditions.length === 0) {
      return this.buildMatchNoneFilter();
    }

    return {
      or: ownershipConditions,
    };
  }

  private buildMatchNoneFilter(): ObjectRecordFilter {
    return {
      and: [{ id: { is: 'NULL' } }, { id: { is: 'NOT_NULL' } }],
    };
  }
}
