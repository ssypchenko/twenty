import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import {
  PERMAVENT_ACTIVE_SALES_REP_CODES_MARKER,
  PermaventCompanyFocusFilterService,
} from 'src/engine/core-modules/permavent-sales-scope/focus/permavent-company-focus-filter.service';
import { type PermaventSalesScopeContextFactory } from 'src/engine/core-modules/permavent-sales-scope/context/permavent-sales-scope-context.factory';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';

const authContext = {} as WorkspaceAuthContext;
const focusFilter = {
  or: [
    { accountOwnerId: { eq: 'workspace-member-id' } },
    {
      erpsalesrepcode: {
        ilike: `%${PERMAVENT_ACTIVE_SALES_REP_CODES_MARKER}%`,
      },
    },
  ],
};

const createService = ({
  enabled = true,
  allowedSalesRepCodes = ['DM', 'RT'],
  isRestrictedSalesRep = true,
}: {
  enabled?: boolean;
  allowedSalesRepCodes?: string[];
  isRestrictedSalesRep?: boolean;
} = {}) => {
  const create = jest.fn().mockResolvedValue({
    isSupportedUserContext: true,
    isRestrictedSalesRep,
    allowedSalesRepCodes,
  });

  return new PermaventCompanyFocusFilterService(
    {
      get: jest.fn().mockReturnValue(enabled),
    } as unknown as TwentyConfigService,
    { create } as unknown as PermaventSalesScopeContextFactory,
  );
};

describe('PermaventCompanyFocusFilterService', () => {
  it.each(['company', 'branch'])(
    'expands the marker for %s focus filters',
    async (nameSingular) => {
      const service = createService();

      await expect(
        service.applyToFilter({
          filter: focusFilter,
          authContext,
          flatObjectMetadata: { nameSingular } as FlatObjectMetadata,
        }),
      ).resolves.toEqual({
        or: [
          { accountOwnerId: { eq: 'workspace-member-id' } },
          { erpsalesrepcode: { in: ['DM', 'RT'] } },
        ],
      });
    },
  );

  it('keeps the owner branch and makes the marker branch match none without assignments', async () => {
    const service = createService({ allowedSalesRepCodes: [] });

    await expect(
      service.applyToFilter({
        filter: focusFilter,
        authContext,
        flatObjectMetadata: { nameSingular: 'company' } as FlatObjectMetadata,
      }),
    ).resolves.toEqual({
      or: [
        { accountOwnerId: { eq: 'workspace-member-id' } },
        {
          and: [{ id: { is: 'NULL' } }, { id: { is: 'NOT_NULL' } }],
        },
      ],
    });
  });

  it.each(['person', 'opportunity'])(
    'does not change %s filters',
    async (nameSingular) => {
      const service = createService();

      await expect(
        service.applyToFilter({
          filter: focusFilter,
          authContext,
          flatObjectMetadata: { nameSingular } as FlatObjectMetadata,
        }),
      ).resolves.toBe(focusFilter);
    },
  );

  it('does not change filters when the feature is disabled', async () => {
    const service = createService({ enabled: false });

    await expect(
      service.applyToFilter({
        filter: focusFilter,
        authContext,
        flatObjectMetadata: { nameSingular: 'company' } as FlatObjectMetadata,
      }),
    ).resolves.toBe(focusFilter);
  });
});
