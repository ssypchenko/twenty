import { type PermaventSecurityContext } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.type';
import { PermaventAccessFilterBuilder } from 'src/engine/core-modules/permavent-security/filters/permavent-access-filter.builder';

describe('PermaventAccessFilterBuilder', () => {
  const builder = new PermaventAccessFilterBuilder();
  const context = {
    workspaceMemberId: 'workspace-member-id',
    allowedSalesRepCodes: ['DM', 'RT'],
  } as PermaventSecurityContext;

  it('should prioritise an ERP code over the CRM account owner', () => {
    expect(builder.buildCompanyOrBranchFilter(context)).toEqual({
      or: [
        { erpsalesrepcode: { in: ['DM', 'RT'] } },
        {
          and: [
            { erpsalesrepcode: { is: 'NULL' } },
            { accountOwnerId: { eq: 'workspace-member-id' } },
          ],
        },
      ],
    });
  });

  it('should allow CRM-owned records without active ERP assignments', () => {
    expect(
      builder.buildCompanyOrBranchFilter({
        ...context,
        allowedSalesRepCodes: [],
      }),
    ).toEqual({
      or: [
        {
          and: [
            { erpsalesrepcode: { is: 'NULL' } },
            { accountOwnerId: { eq: 'workspace-member-id' } },
          ],
        },
      ],
    });
  });

  it('should fail closed without a workspace member or ERP assignments', () => {
    expect(
      builder.buildCompanyOrBranchFilter({
        ...context,
        workspaceMemberId: null,
        allowedSalesRepCodes: [],
      }),
    ).toEqual({
      and: [{ id: { is: 'NULL' } }, { id: { is: 'NOT_NULL' } }],
    });
  });

  it('should prioritise Branch ownership for related records', () => {
    expect(builder.buildRelatedCompanyOrBranchFilter(context)).toEqual({
      or: [
        {
          and: [
            { branchId: { is: 'NULL' } },
            {
              company: {
                or: [
                  { erpsalesrepcode: { in: ['DM', 'RT'] } },
                  {
                    and: [
                      { erpsalesrepcode: { is: 'NULL' } },
                      { accountOwnerId: { eq: 'workspace-member-id' } },
                    ],
                  },
                ],
              },
            },
          ],
        },
        {
          and: [
            { branchId: { is: 'NOT_NULL' } },
            {
              branch: {
                or: [
                  { erpsalesrepcode: { in: ['DM', 'RT'] } },
                  {
                    and: [
                      { erpsalesrepcode: { is: 'NULL' } },
                      { accountOwnerId: { eq: 'workspace-member-id' } },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    });
  });
});
