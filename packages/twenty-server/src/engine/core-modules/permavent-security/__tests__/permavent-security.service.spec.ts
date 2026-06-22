import { CommonQueryNames } from 'src/engine/api/common/types/common-query-args.type';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type PermaventSecurityContextFactory } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.factory';
import { type PermaventSecurityContext } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.type';
import { PermaventAccessFilterBuilder } from 'src/engine/core-modules/permavent-security/filters/permavent-access-filter.builder';
import { PermaventSecurityService } from 'src/engine/core-modules/permavent-security/permavent-security.service';
import { type PermaventCommonQueryHookInput } from 'src/engine/core-modules/permavent-security/types/permavent-common-query-hook-input.type';
import { ConfigVariables } from 'src/engine/core-modules/twenty-config/config-variables';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { isEnvOnlyConfigVar } from 'src/engine/core-modules/twenty-config/utils/is-env-only-config-var.util';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';

describe('PermaventSecurityService', () => {
  const getConfigVariable = jest.fn();
  const createSecurityContext = jest.fn();
  const service = new PermaventSecurityService(
    {
      get: getConfigVariable,
    } as unknown as TwentyConfigService,
    {
      create: createSecurityContext,
    } as unknown as PermaventSecurityContextFactory,
    new PermaventAccessFilterBuilder(),
  );

  const args = {
    filter: {
      name: {
        eq: 'Example company',
      },
    },
    first: 20,
  };

  const input: PermaventCommonQueryHookInput<typeof args> = {
    args,
    operationName: CommonQueryNames.FIND_MANY,
    authContext: {} as WorkspaceAuthContext,
    flatObjectMetadata: {
      nameSingular: 'company',
    } as FlatObjectMetadata,
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
    createSecurityContext.mockResolvedValue(restrictedSalesRepContext);
  });

  it('should return the original arguments when disabled', async () => {
    getConfigVariable.mockReturnValue(false);

    const result = await service.applyToCommonQueryArgs(input);

    expect(result).toBe(args);
    expect(getConfigVariable).toHaveBeenCalledWith(
      'PERMAVENT_SECURITY_RLS_ENABLED',
    );
    expect(createSecurityContext).not.toHaveBeenCalled();
  });

  it('should merge a Sales Rep filter into a Company read', async () => {
    getConfigVariable.mockReturnValue(true);

    const result = await service.applyToCommonQueryArgs(input);

    expect(result).toEqual({
      first: 20,
      filter: {
        and: [
          args.filter,
          {
            or: [
              {
                salesrepemail: {
                  primaryEmail: {
                    ilike: 'sales.rep@example.test',
                  },
                },
              },
              {
                erpsalesrepcode: {
                  in: ['DM', 'RT'],
                },
              },
            ],
          },
        ],
      },
    });
    expect(args.filter).toEqual({ name: { eq: 'Example company' } });
  });

  it('should fail closed when a Sales Rep has no active codes', async () => {
    getConfigVariable.mockReturnValue(true);
    createSecurityContext.mockResolvedValue({
      ...restrictedSalesRepContext,
      allowedSalesRepCodes: [],
    });

    const result = await service.applyToCommonQueryArgs({
      ...input,
      args: { first: 20 },
      flatObjectMetadata: {
        nameSingular: 'branch',
      } as FlatObjectMetadata,
    });

    expect(result).toEqual({
      first: 20,
      filter: {
        and: [{ id: { is: 'NULL' } }, { id: { is: 'NOT_NULL' } }],
      },
    });
  });

  it('should not filter a bypass role', async () => {
    getConfigVariable.mockReturnValue(true);
    createSecurityContext.mockResolvedValue({
      ...restrictedSalesRepContext,
      bypassSecurity: true,
      isRestrictedSalesRep: false,
      allowedSalesRepCodes: [],
    });

    const result = await service.applyToCommonQueryArgs(input);

    expect(result).toBe(args);
  });

  it('should not filter an unmanaged role', async () => {
    getConfigVariable.mockReturnValue(true);
    createSecurityContext.mockResolvedValue({
      ...restrictedSalesRepContext,
      isRestrictedSalesRep: false,
      allowedSalesRepCodes: [],
    });

    const result = await service.applyToCommonQueryArgs(input);

    expect(result).toBe(args);
  });

  it('should not build a context for an out-of-scope object', async () => {
    getConfigVariable.mockReturnValue(true);

    const result = await service.applyToCommonQueryArgs({
      ...input,
      flatObjectMetadata: {
        nameSingular: 'person',
      } as FlatObjectMetadata,
    });

    expect(result).toBe(args);
    expect(createSecurityContext).not.toHaveBeenCalled();
  });

  it('should not build a context for a mutation', async () => {
    getConfigVariable.mockReturnValue(true);

    const result = await service.applyToCommonQueryArgs({
      ...input,
      operationName: CommonQueryNames.UPDATE_ONE,
    });

    expect(result).toBe(args);
    expect(createSecurityContext).not.toHaveBeenCalled();
  });

  it('should define the feature flag as environment-only and disabled by default', () => {
    expect(new ConfigVariables().PERMAVENT_SECURITY_RLS_ENABLED).toBe(false);
    expect(isEnvOnlyConfigVar('PERMAVENT_SECURITY_RLS_ENABLED')).toBe(true);
  });
});
