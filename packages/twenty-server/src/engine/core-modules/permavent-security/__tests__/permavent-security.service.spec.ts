import { CommonQueryNames } from 'src/engine/api/common/types/common-query-args.type';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type PermaventSecurityContextFactory } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.factory';
import { type PermaventSecurityContext } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.type';
import { PermaventAccessFilterBuilder } from 'src/engine/core-modules/permavent-security/filters/permavent-access-filter.builder';
import {
  PERMAVENT_ACTIVE_SALES_REP_CODES_MARKER,
  PermaventCompanyFocusFilterService,
} from 'src/engine/core-modules/permavent-security/focus/permavent-company-focus-filter.service';
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
    new PermaventCompanyFocusFilterService(
      { get: getConfigVariable } as unknown as TwentyConfigService,
      {
        create: createSecurityContext,
      } as unknown as PermaventSecurityContextFactory,
    ),
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
    primarySalesRepCode: 'DM',
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

  it.each(['company', 'branch'])(
    'should expand the focus marker for a %s while CRM territory RLS is disabled',
    async (nameSingular) => {
      getConfigVariable.mockImplementation(
        (key) => key === 'PERMAVENT_MY_COMPANIES_FOCUS_ENABLED',
      );
      const focusArgs = {
        filter: {
          or: [
            { accountOwnerId: { eq: 'workspace-member-id' } },
            {
              createdBy: {
                workspaceMemberId: { eq: 'workspace-member-id' },
              },
            },
            {
              erpsalesrepcode: {
                ilike: `%${PERMAVENT_ACTIVE_SALES_REP_CODES_MARKER}%`,
              },
            },
          ],
        },
      };

      await expect(
        service.applyToCommonQueryArgs({
          ...input,
          args: focusArgs,
          flatObjectMetadata: { nameSingular } as FlatObjectMetadata,
        }),
      ).resolves.toEqual({
        filter: {
          or: [
            { accountOwnerId: { eq: 'workspace-member-id' } },
            {
              createdBy: {
                workspaceMemberId: { eq: 'workspace-member-id' },
              },
            },
            { erpsalesrepcode: { in: ['DM', 'RT'] } },
          ],
        },
      });
    },
  );

  it.each(['company', 'branch'])(
    'should preserve the owner branch for a %s when a Sales Rep has no assignments',
    async (nameSingular) => {
      getConfigVariable.mockImplementation(
        (key) => key === 'PERMAVENT_MY_COMPANIES_FOCUS_ENABLED',
      );
      createSecurityContext.mockResolvedValue({
        ...restrictedSalesRepContext,
        allowedSalesRepCodes: [],
      });
      const focusArgs = {
        filter: {
          or: [
            { accountOwnerId: { eq: 'workspace-member-id' } },
            {
              erpsalesrepcode: {
                ilike: `%${PERMAVENT_ACTIVE_SALES_REP_CODES_MARKER}%`,
              },
            },
          ],
        },
      };

      await expect(
        service.applyToCommonQueryArgs({
          ...input,
          args: focusArgs,
          flatObjectMetadata: { nameSingular } as FlatObjectMetadata,
        }),
      ).resolves.toEqual({
        filter: {
          or: [
            { accountOwnerId: { eq: 'workspace-member-id' } },
            {
              and: [{ id: { is: 'NULL' } }, { id: { is: 'NOT_NULL' } }],
            },
          ],
        },
      });
    },
  );

  it('should leave the marker unchanged when the focus feature is disabled', async () => {
    getConfigVariable.mockReturnValue(false);
    const focusArgs = {
      filter: {
        erpsalesrepcode: {
          ilike: `%${PERMAVENT_ACTIVE_SALES_REP_CODES_MARKER}%`,
        },
      },
    };

    await expect(
      service.applyToCommonQueryArgs({ ...input, args: focusArgs }),
    ).resolves.toBe(focusArgs);
  });

  it.each(['person', 'opportunity'])(
    'should not expand the focus marker for a %s',
    async (nameSingular) => {
      getConfigVariable.mockImplementation(
        (key) => key === 'PERMAVENT_MY_COMPANIES_FOCUS_ENABLED',
      );
      const focusArgs = {
        filter: {
          erpsalesrepcode: {
            ilike: `%${PERMAVENT_ACTIVE_SALES_REP_CODES_MARKER}%`,
          },
        },
      };

      await expect(
        service.applyToCommonQueryArgs({
          ...input,
          args: focusArgs,
          flatObjectMetadata: { nameSingular } as FlatObjectMetadata,
        }),
      ).resolves.toBe(focusArgs);
    },
  );

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

  it.each(['company', 'branch'])(
    'should default a Sales Rep owner for a manually created %s without clearing ERP input',
    async (nameSingular) => {
      await expect(
        service.applyToCommonQueryArgs({
          ...input,
          operationName: CommonQueryNames.CREATE_ONE,
          args: { data: { name: 'Example company', erpsalesrepcode: 'DM' } },
          flatObjectMetadata: { nameSingular } as FlatObjectMetadata,
        }),
      ).resolves.toMatchObject({
        data: {
          name: 'Example company',
          erpsalesrepcode: 'DM',
          accountOwnerId: 'workspace-member-id',
        },
      });
    },
  );

  it.each([
    {
      operationName: CommonQueryNames.CREATE_ONE,
      args: {
        data: {
          name: 'Example company',
          erpsalesrepcode: PERMAVENT_ACTIVE_SALES_REP_CODES_MARKER,
        },
      },
      objectNameSingular: 'company',
    },
    {
      operationName: CommonQueryNames.UPDATE_ONE,
      args: {
        id: 'company-id',
        data: {
          erpsalesrepcode: PERMAVENT_ACTIVE_SALES_REP_CODES_MARKER,
        },
      },
      objectNameSingular: 'branch',
    },
  ])(
    'should reject the active Sales Rep marker for a $objectNameSingular mutation',
    async ({ operationName, args, objectNameSingular }) => {
      await expect(
        service.applyToCommonQueryArgs({
          ...input,
          operationName,
          args,
          flatObjectMetadata: {
            nameSingular: objectNameSingular,
          } as FlatObjectMetadata,
        }),
      ).rejects.toThrow(
        'The active Sales Rep marker cannot be stored in a Company or Branch record.',
      );
    },
  );

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

  it('should resolve unrestricted ERP sales scope for a bypass role', async () => {
    createSecurityContext.mockResolvedValue({
      ...restrictedSalesRepContext,
      bypassSecurity: true,
      isRestrictedSalesRep: false,
      allowedSalesRepCodes: [],
    });

    await expect(
      service.resolveErpSalesScope({} as WorkspaceAuthContext),
    ).resolves.toEqual({
      mode: 'ALL',
      salesRepCodes: [],
    });
  });

  it('should resolve assigned ERP sales scope for a Sales Rep', async () => {
    await expect(
      service.resolveErpSalesScope({} as WorkspaceAuthContext),
    ).resolves.toEqual({
      mode: 'ASSIGNED',
      salesRepCodes: ['DM', 'RT'],
      primarySalesRepCode: 'DM',
    });
  });

  it('should fail closed when a Sales Rep has no ERP assignments', async () => {
    createSecurityContext.mockResolvedValue({
      ...restrictedSalesRepContext,
      allowedSalesRepCodes: [],
    });

    await expect(
      service.resolveErpSalesScope({} as WorkspaceAuthContext),
    ).resolves.toEqual({
      mode: 'NONE',
      salesRepCodes: [],
    });
  });

  it('should fail closed when ERP sales scope is disabled', async () => {
    getConfigVariable.mockImplementation(
      (key) => key !== 'PERMAVENT_ERP_SALES_SCOPE_ENABLED',
    );

    await expect(
      service.resolveErpSalesScope({} as WorkspaceAuthContext),
    ).resolves.toEqual({
      mode: 'NONE',
      salesRepCodes: [],
    });
    expect(createSecurityContext).not.toHaveBeenCalled();
  });

  it('should expose server-derived actor context to Logic Functions', async () => {
    await expect(
      service.resolveLogicFunctionActorContext({} as WorkspaceAuthContext),
    ).resolves.toEqual({
      workspaceMemberId: 'workspace-member-id',
      userEmail: 'sales.rep@example.test',
      roleUniversalIdentifier: 'sales-rep-role-universal-identifier',
      isRestrictedSalesRep: true,
    });
  });

  it('should not expose actor context for an unsupported auth context', async () => {
    createSecurityContext.mockResolvedValue({
      ...restrictedSalesRepContext,
      isSupportedUserContext: false,
    });

    await expect(
      service.resolveLogicFunctionActorContext({} as WorkspaceAuthContext),
    ).resolves.toBeNull();
  });

  it('should not resolve actor context while Weekly Sales Report is disabled', async () => {
    getConfigVariable.mockReturnValue(false);

    await expect(
      service.resolveLogicFunctionActorContext({} as WorkspaceAuthContext),
    ).resolves.toBeNull();
    expect(createSecurityContext).not.toHaveBeenCalled();
  });

  it('should leave security disabled behaviour unchanged', async () => {
    getConfigVariable.mockReturnValue(false);

    await expect(service.applyToCommonQueryArgs(input)).resolves.toBe(args);
    expect(createSecurityContext).not.toHaveBeenCalled();
  });

  it('should protect Sales Rep assignments when CRM territory RLS is disabled', async () => {
    getConfigVariable.mockReturnValue(false);

    await expect(
      service.applyToCommonQueryArgs({
        ...input,
        operationName: CommonQueryNames.FIND_MANY,
        flatObjectMetadata: {
          nameSingular: 'salesrepassignment',
        } as FlatObjectMetadata,
      }),
    ).rejects.toMatchObject({
      code: PermissionsExceptionCode.PERMISSION_DENIED,
    });
  });

  it('should define the feature flag as environment-only and disabled by default', () => {
    expect(new ConfigVariables().PERMAVENT_SECURITY_RLS_ENABLED).toBe(false);
    expect(isEnvOnlyConfigVar('PERMAVENT_SECURITY_RLS_ENABLED')).toBe(true);
    expect(new ConfigVariables().PERMAVENT_ERP_SALES_SCOPE_ENABLED).toBe(false);
    expect(isEnvOnlyConfigVar('PERMAVENT_ERP_SALES_SCOPE_ENABLED')).toBe(true);
    expect(new ConfigVariables().PERMAVENT_WEEKLY_SALES_REPORT_ENABLED).toBe(
      false,
    );
    expect(isEnvOnlyConfigVar('PERMAVENT_WEEKLY_SALES_REPORT_ENABLED')).toBe(
      true,
    );
    expect(new ConfigVariables().PERMAVENT_MY_COMPANIES_FOCUS_ENABLED).toBe(
      false,
    );
    expect(isEnvOnlyConfigVar('PERMAVENT_MY_COMPANIES_FOCUS_ENABLED')).toBe(
      true,
    );
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
