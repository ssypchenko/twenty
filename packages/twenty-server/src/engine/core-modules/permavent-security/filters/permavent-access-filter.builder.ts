import { Injectable } from '@nestjs/common';

import { type ObjectRecordFilter } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';
import { type PermaventSecurityContext } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.type';

@Injectable()
export class PermaventAccessFilterBuilder {
  public buildCompanyOrBranchFilter({
    userEmail,
    allowedSalesRepCodes,
  }: PermaventSecurityContext): ObjectRecordFilter {
    if (userEmail === null || allowedSalesRepCodes.length === 0) {
      return {
        and: [{ id: { is: 'NULL' } }, { id: { is: 'NOT_NULL' } }],
      };
    }

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
}
