import { CommonQueryNames } from 'src/engine/api/common/types/common-query-args.type';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type PermaventSecurityContextFactory } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.factory';
import { type PermaventSecurityContext } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.type';
import { PermaventAccessFilterBuilder } from 'src/engine/core-modules/permavent-security/filters/permavent-access-filter.builder';
import {
  PERMAVENT_SYSTEM_FIELD_NAMES,
  PermaventSecurityService,
} from 'src/engine/core-modules/permavent-security/permavent-security.service';
import { type PermaventCommonQueryHookInput } from 'src/engine/core-modules/permavent-security/types/permavent-common-query-hook-input.type';
import { ConfigVariables } from 'src/engine/core-modules/twenty-config/config-variables';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { isEnvOnlyConfigVar } from 'src/engine/core-modules/twenty-config/utils/is-env-only-config-var.util';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { PermissionsExceptionCode } from 'src/engine/metadata-modules/permissions/permissions.exception';

describe('PermaventSecurityService', () => {
  const getConfigVariable = jest.fn();
  const createSecurityContext = jest.fn();
  const service = new PermaventSecurityService(
    { get: getConfigVariable } as unknown as TwentyConfigService,
    {
      create: createSecurityContext,
    } as unknown as PermaventSecurityContextFactory,
    new PermaventAccessFilterBuilder(),
  );
  const args = { filter: { name: { eq: 'Example company' } }, first: 20 };
  const input: PermaventCommonQueryHookInput<typeof args> = {
    args,
    operationName: CommonQueryNames.FIND_MANY,
    authContext: {} as WorkspaceAuthContext,
    flatObjectMetadata: { nameSingular: 'company' } as FlatObjectMetadata,
  };
  const restrictedSalesRepContext: PermaventSecurityContext = {
    authContextType: 'user',
    workspaceId: 'workspace-id',
    workspaceMemberId: 'workspace-member-id',
    userWorkspaceId: 'user-workspace-id',
    userEmail: 'sales.rep@example.test',
    roleId: 'sales-rep-role-id',
    roleUniversalIdentifier: 'sales-rep-role-universal-identifier',
    roleLabel: 'SalesRep',
    bypassSecurity: false,
    isRestrictedSalesRep: true,
    allowedSalesRepCodes: ['DM', 'RT'],
    isSupportedUserContext: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getConfigVariable.mockReturnValue(true);
    createSecurityContext.mockResolvedValue(restrictedSalesRepContext);
  });

  it('should merge ERP-first ownership into a Company read', async () => {
    await expect(service.applyToCommonQueryArgs(input)).resolves.toEqual({
      first: 20,
      filter: {
        and: [
          args.filter,
          {
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
        ],
      },
    });
  });

  it('should allow CRM-owned reads without ERP assignments', async () => {
    createSecurityContext.mockResolvedValue({
      ...restrictedSalesRepContext,
      allowedSalesRepCodes: [],
    });

    await expect(service.applyToCommonQueryArgs(input)).resolves.toEqual({
      first: 20,
      filter: {
        and: [
          args.filter,
          {
            or: [
              {
                and: [
                  { erpsalesrepcode: { is: 'NULL' } },
                  { accountOwnerId: { eq: 'workspace-member-id' } },
                ],
              },
            ],
          },
        ],
      },
    });
  });

  it.each(['person', 'opportunity'])(
    'should use Branch ownership before Company ownership for a %s read',
    async (nameSingular) => {
      await expect(
        service.applyToCommonQueryArgs({
          ...input,
          flatObjectMetadata: { nameSingular } as FlatObjectMetadata,
        }),
      ).resolves.toMatchObject({
        filter: {
          and: [
            args.filter,
            {
              or: [
                {
                  and: [{ branchId: { is: 'NULL' } }, expect.any(Object)],
                },
                {
                  and: [{ branchId: { is: 'NOT_NULL' } }, expect.any(Object)],
                },
              ],
            },
          ],
        },
      });
    },
  );

  it('should default a Sales Rep Company owner without clearing ERP input', async () => {
    await expect(
      service.applyToCommonQueryArgs({
        ...input,
        operationName: CommonQueryNames.CREATE_ONE,
        args: { data: { name: 'Example company', erpsalesrepcode: 'DM' } },
      }),
    ).resolves.toMatchObject({
      data: {
        name: 'Example company',
        erpsalesrepcode: 'DM',
        accountOwnerId: 'workspace-member-id',
      },
    });
  });

  it('should replace an explicitly supplied owner with the Sales Rep owner', async () => {
    const result = await service.applyToCommonQueryArgs({
      ...input,
      operationName: CommonQueryNames.CREATE_ONE,
      args: { data: { accountOwnerId: 'chosen-owner-id' } },
    });

    expect(result).toMatchObject({
      data: { accountOwnerId: 'workspace-member-id' },
    });
    expect(
      (
        result as typeof result & {
          [PERMAVENT_SYSTEM_FIELD_NAMES]?: string[];
        }
      )[PERMAVENT_SYSTEM_FIELD_NAMES],
    ).toEqual(['accountOwnerId']);
  });

  it('should deny Sales Rep upsert for Company and Branch', async () => {
    await expect(
      service.applyToCommonQueryArgs({
        ...input,
        operationName: CommonQueryNames.CREATE_ONE,
        args: { data: {}, upsert: true },
      }),
    ).rejects.toMatchObject({
      code: PermissionsExceptionCode.PERMISSION_DENIED,
    });
  });

  it('should scope a Sales Rep update to owned Company records', async () => {
    await expect(
      service.applyToCommonQueryArgs({
        ...input,
        operationName: CommonQueryNames.UPDATE_MANY,
        args: {
          filter: { id: { eq: 'company-id' } },
          data: { name: 'Updated' },
        },
      }),
    ).resolves.toMatchObject({
      filter: {
        and: [{ id: { eq: 'company-id' } }, expect.any(Object)],
      },
    });
  });

  it('should deny soft deletion of ERP Company and Branch records', async () => {
    await expect(
      service.applyToMutationFilter({
        filter: { id: { eq: 'company-id' } },
        operationName: CommonQueryNames.DELETE_ONE,
        authContext: {} as WorkspaceAuthContext,
        flatObjectMetadata: { nameSingular: 'company' } as FlatObjectMetadata,
      }),
    ).resolves.toMatchObject({
      and: expect.arrayContaining([{ erpsalesrepcode: { is: 'NULL' } }]),
    });
  });

  it.each([
    CommonQueryNames.DESTROY_ONE,
    CommonQueryNames.DESTROY_MANY,
    CommonQueryNames.RESTORE_ONE,
    CommonQueryNames.RESTORE_MANY,
    CommonQueryNames.MERGE_MANY,
  ])(
    'should deny Sales Rep operation %s for a Company',
    async (operationName) => {
      await expect(
        service.applyToCommonQueryArgs({ ...input, operationName }),
      ).rejects.toMatchObject({
        code: PermissionsExceptionCode.PERMISSION_DENIED,
      });
    },
  );

  it.each([
    CommonQueryNames.CREATE_ONE,
    CommonQueryNames.UPDATE_ONE,
    CommonQueryNames.DELETE_ONE,
    CommonQueryNames.FIND_ONE,
    CommonQueryNames.FIND_MANY,
    CommonQueryNames.FIND_DUPLICATES,
    CommonQueryNames.GROUP_BY,
  ])(
    'should deny Sales Rep operation %s for Sales Rep assignments',
    async (operationName) => {
      await expect(
        service.applyToCommonQueryArgs({
          ...input,
          operationName,
          flatObjectMetadata: {
            nameSingular: 'salesrepassignment',
          } as FlatObjectMetadata,
        }),
      ).rejects.toMatchObject({
        code: PermissionsExceptionCode.PERMISSION_DENIED,
      });
    },
  );

  it('should not filter a bypass role', async () => {
    createSecurityContext.mockResolvedValue({
      ...restrictedSalesRepContext,
      bypassSecurity: true,
      isRestrictedSalesRep: false,
    });

    await expect(service.applyToCommonQueryArgs(input)).resolves.toBe(args);
  });

  it('should leave security disabled behaviour unchanged', async () => {
    getConfigVariable.mockReturnValue(false);

    await expect(service.applyToCommonQueryArgs(input)).resolves.toBe(args);
    expect(createSecurityContext).not.toHaveBeenCalled();
  });

  it('should define the feature flag as environment-only and disabled by default', () => {
    expect(new ConfigVariables().PERMAVENT_SECURITY_RLS_ENABLED).toBe(false);
    expect(isEnvOnlyConfigVar('PERMAVENT_SECURITY_RLS_ENABLED')).toBe(true);
    expect(new ConfigVariables().PERMAVENT_DELEGATED_API_CONTEXT_ENABLED).toBe(
      false,
    );
    expect(new ConfigVariables().PERMAVENT_DELEGATED_API_KEY_IDS).toBe('');
    expect(isEnvOnlyConfigVar('PERMAVENT_DELEGATED_API_CONTEXT_ENABLED')).toBe(
      true,
    );
    expect(isEnvOnlyConfigVar('PERMAVENT_DELEGATED_API_KEY_IDS')).toBe(true);
  });
});
