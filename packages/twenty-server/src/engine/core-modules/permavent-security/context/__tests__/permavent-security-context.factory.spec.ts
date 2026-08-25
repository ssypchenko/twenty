import {
  type UserWorkspaceAuthContext,
  type WorkspaceAuthContext,
} from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type PermaventSalesRepAssignmentService } from 'src/engine/core-modules/permavent-security/assignments/permavent-sales-rep-assignment.service';
import { PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS } from 'src/engine/core-modules/permavent-security/constants/permavent-role-universal-identifiers.constant';
import { PermaventSecurityContextFactory } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.factory';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { STANDARD_ROLE } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-role.constant';

describe('PermaventSecurityContextFactory', () => {
  const getOrRecompute = jest.fn();
  const findAllowedSalesRepCodes = jest.fn();
  const findPrimarySalesRepCode = jest.fn();
  let factory: PermaventSecurityContextFactory;

  const userAuthContext = {
    type: 'user',
    workspace: { id: 'workspace-id' },
    workspaceMemberId: 'workspace-member-id',
    workspaceMember: { id: 'workspace-member-id' },
    userWorkspaceId: 'user-workspace-id',
    user: {
      id: 'user-id',
      email: ' Sales.Rep@Example.test ',
    },
  } as unknown as UserWorkspaceAuthContext;

  beforeEach(() => {
    jest.clearAllMocks();
    findAllowedSalesRepCodes.mockResolvedValue(['DM', 'RT']);
    findPrimarySalesRepCode.mockResolvedValue('DM');
    factory = new PermaventSecurityContextFactory(
      {
        getOrRecompute,
      } as unknown as WorkspaceCacheService,
      {
        findAllowedSalesRepCodes,
        findPrimarySalesRepCode,
      } as unknown as PermaventSalesRepAssignmentService,
    );
  });

  it('should extract a user context and resolve its role', async () => {
    getOrRecompute.mockResolvedValue({
      userWorkspaceRoleMap: {
        'user-workspace-id': 'sales-rep-role-id',
      },
      flatRoleMaps: {
        universalIdentifierById: {
          'sales-rep-role-id': PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS.salesRep,
        },
        byUniversalIdentifier: {
          [PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS.salesRep]: {
            id: 'sales-rep-role-id',
            label: 'SalesRep',
          },
        },
      },
    });

    const result = await factory.create(userAuthContext);

    expect(result).toEqual({
      authContextType: 'user',
      workspaceId: 'workspace-id',
      workspaceMemberId: 'workspace-member-id',
      userWorkspaceId: 'user-workspace-id',
      userEmail: 'sales.rep@example.test',
      roleId: 'sales-rep-role-id',
      roleUniversalIdentifier: PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS.salesRep,
      roleLabel: 'SalesRep',
      bypassSecurity: false,
      isRestrictedSalesRep: true,
      allowedSalesRepCodes: ['DM', 'RT'],
      primarySalesRepCode: 'DM',
      isSupportedUserContext: true,
    });
    expect(getOrRecompute).toHaveBeenCalledWith('workspace-id', [
      'flatRoleMaps',
      'userWorkspaceRoleMap',
    ]);
    expect(findAllowedSalesRepCodes).toHaveBeenCalledWith({
      workspaceId: 'workspace-id',
      workspaceMemberId: 'workspace-member-id',
    });
    expect(findPrimarySalesRepCode).toHaveBeenCalledWith({
      workspaceId: 'workspace-id',
      workspaceMemberId: 'workspace-member-id',
    });
  });

  it('should grant the bypass flag to the standard Admin role', async () => {
    getOrRecompute.mockResolvedValue({
      userWorkspaceRoleMap: {
        'user-workspace-id': 'admin-role-id',
      },
      flatRoleMaps: {
        universalIdentifierById: {
          'admin-role-id': STANDARD_ROLE.admin.universalIdentifier,
        },
        byUniversalIdentifier: {
          [STANDARD_ROLE.admin.universalIdentifier]: {
            id: 'admin-role-id',
            label: 'Admin',
          },
        },
      },
    });

    const result = await factory.create(userAuthContext);

    expect(result.bypassSecurity).toBe(true);
    expect(result.isRestrictedSalesRep).toBe(false);
    expect(result.allowedSalesRepCodes).toEqual([]);
    expect(findAllowedSalesRepCodes).not.toHaveBeenCalled();
    expect(findPrimarySalesRepCode).not.toHaveBeenCalled();
  });

  it('should grant the bypass flag to the Permavent SalesManager role', async () => {
    getOrRecompute.mockResolvedValue({
      userWorkspaceRoleMap: {
        'user-workspace-id': 'sales-manager-role-id',
      },
      flatRoleMaps: {
        universalIdentifierById: {
          'sales-manager-role-id':
            PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS.salesManager,
        },
        byUniversalIdentifier: {
          [PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS.salesManager]: {
            id: 'sales-manager-role-id',
            label: 'SalesManager',
          },
        },
      },
    });

    const result = await factory.create(userAuthContext);

    expect(result.bypassSecurity).toBe(true);
    expect(result.isRestrictedSalesRep).toBe(false);
    expect(result.allowedSalesRepCodes).toEqual([]);
    expect(findAllowedSalesRepCodes).not.toHaveBeenCalled();
    expect(findPrimarySalesRepCode).not.toHaveBeenCalled();
  });

  it('should leave an unmanaged role outside the Permavent policy', async () => {
    getOrRecompute.mockResolvedValue({
      userWorkspaceRoleMap: {
        'user-workspace-id': 'member-role-id',
      },
      flatRoleMaps: {
        universalIdentifierById: {
          'member-role-id': 'member-role-universal-identifier',
        },
        byUniversalIdentifier: {
          'member-role-universal-identifier': {
            id: 'member-role-id',
            label: 'Member',
          },
        },
      },
    });

    const result = await factory.create(userAuthContext);

    expect(result.bypassSecurity).toBe(false);
    expect(result.isRestrictedSalesRep).toBe(false);
    expect(result.allowedSalesRepCodes).toEqual([]);
    expect(findAllowedSalesRepCodes).not.toHaveBeenCalled();
    expect(findPrimarySalesRepCode).not.toHaveBeenCalled();
  });

  it('should represent unsupported authentication contexts without a bypass', async () => {
    const result = await factory.create({
      type: 'system',
      workspace: { id: 'workspace-id' },
    } as unknown as WorkspaceAuthContext);

    expect(result).toEqual({
      authContextType: 'system',
      workspaceId: 'workspace-id',
      workspaceMemberId: null,
      userWorkspaceId: null,
      userEmail: null,
      roleId: null,
      roleUniversalIdentifier: null,
      roleLabel: null,
      bypassSecurity: false,
      isRestrictedSalesRep: false,
      allowedSalesRepCodes: [],
      primarySalesRepCode: null,
      isSupportedUserContext: false,
    });
    expect(getOrRecompute).not.toHaveBeenCalled();
    expect(findAllowedSalesRepCodes).not.toHaveBeenCalled();
    expect(findPrimarySalesRepCode).not.toHaveBeenCalled();
  });

  it('should resolve the actor in a delegated API key context', async () => {
    getOrRecompute.mockResolvedValue({
      userWorkspaceRoleMap: {},
      flatRoleMaps: {
        universalIdentifierById: {
          'sales-rep-role-id': PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS.salesRep,
        },
        byUniversalIdentifier: {
          [PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS.salesRep]: {
            id: 'sales-rep-role-id',
            label: 'SalesRep',
          },
        },
      },
    });

    const result = await factory.create({
      type: 'apiKey',
      workspace: { id: 'workspace-id' },
      apiKey: { id: 'api-key-id' },
      delegatedActor: {
        user: { id: 'user-id', email: 'sales.rep@example.test' },
        userWorkspaceId: 'user-workspace-id',
        workspaceMemberId: 'workspace-member-id',
        workspaceMember: { id: 'workspace-member-id' },
        roleId: 'sales-rep-role-id',
        roleUniversalIdentifier: PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS.salesRep,
        correlationId: 'correlation-id',
      },
    } as unknown as WorkspaceAuthContext);

    expect(result).toMatchObject({
      authContextType: 'apiKey',
      workspaceMemberId: 'workspace-member-id',
      userWorkspaceId: 'user-workspace-id',
      roleId: 'sales-rep-role-id',
      isRestrictedSalesRep: true,
      isSupportedUserContext: true,
      allowedSalesRepCodes: ['DM', 'RT'],
      primarySalesRepCode: 'DM',
    });
    expect(findAllowedSalesRepCodes).toHaveBeenCalledWith({
      workspaceId: 'workspace-id',
      workspaceMemberId: 'workspace-member-id',
    });
    expect(findPrimarySalesRepCode).toHaveBeenCalledWith({
      workspaceId: 'workspace-id',
      workspaceMemberId: 'workspace-member-id',
    });
  });

  it('should represent an internal context without a hydrated workspace', async () => {
    const result = await factory.create({
      type: 'system',
    } as unknown as WorkspaceAuthContext);

    expect(result.workspaceId).toBeNull();
    expect(result.isSupportedUserContext).toBe(false);
    expect(getOrRecompute).not.toHaveBeenCalled();
    expect(findAllowedSalesRepCodes).not.toHaveBeenCalled();
    expect(findPrimarySalesRepCode).not.toHaveBeenCalled();
  });

  it('should memoise a context for the same authentication context', async () => {
    getOrRecompute.mockResolvedValue({
      userWorkspaceRoleMap: {
        'user-workspace-id': 'sales-rep-role-id',
      },
      flatRoleMaps: {
        universalIdentifierById: {
          'sales-rep-role-id': PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS.salesRep,
        },
        byUniversalIdentifier: {
          [PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS.salesRep]: {
            id: 'sales-rep-role-id',
            label: 'SalesRep',
          },
        },
      },
    });

    const [firstResult, secondResult] = await Promise.all([
      factory.create(userAuthContext),
      factory.create(userAuthContext),
    ]);

    expect(secondResult).toBe(firstResult);
    expect(getOrRecompute).toHaveBeenCalledTimes(1);
    expect(findAllowedSalesRepCodes).toHaveBeenCalledTimes(1);
    expect(findPrimarySalesRepCode).toHaveBeenCalledTimes(1);
  });
});
