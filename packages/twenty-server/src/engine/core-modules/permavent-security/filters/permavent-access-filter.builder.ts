import { Injectable } from '@nestjs/common';

import { type ObjectRecordFilter } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';
import { type PermaventSecurityContext } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.type';

@Injectable()
export class PermaventAccessFilterBuilder {
  public buildCompanyOrBranchFilter(
    context: PermaventSecurityContext,
  ): ObjectRecordFilter {
    if (!this.hasActiveOwnershipContext(context)) {
      return this.buildMatchNoneFilter();
    }

    return this.buildDirectOwnershipFilter(context);
  }

  public buildPersonFilter(
    context: PermaventSecurityContext,
  ): ObjectRecordFilter {
    if (!this.hasActiveOwnershipContext(context)) {
      return this.buildMatchNoneFilter();
    }

    return {
      or: [
        { company: this.buildDirectOwnershipFilter(context) },
        { branch: this.buildDirectOwnershipFilter(context) },
      ],
    };
  }

  private hasActiveOwnershipContext({
    userEmail,
    allowedSalesRepCodes,
  }: PermaventSecurityContext): boolean {
    return userEmail !== null && allowedSalesRepCodes.length > 0;
  }

  private buildDirectOwnershipFilter({
    userEmail,
    allowedSalesRepCodes,
  }: PermaventSecurityContext): ObjectRecordFilter {
    return {
      or: [
        {
          salesrepemail: {
            primaryEmail: {
              ilike: userEmail,
            },
          },
        },
        {
          erpsalesrepcode: {
            in: allowedSalesRepCodes,
          },
        },
      ],
    };
  }

  private buildMatchNoneFilter(): ObjectRecordFilter {
    return {
      and: [{ id: { is: 'NULL' } }, { id: { is: 'NOT_NULL' } }],
    };
  }
}
