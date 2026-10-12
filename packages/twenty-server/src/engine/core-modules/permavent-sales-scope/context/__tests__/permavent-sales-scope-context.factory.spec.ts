import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type PermaventSalesRepAssignmentService } from 'src/engine/core-modules/permavent-sales-scope/assignments/permavent-sales-rep-assignment.service';
import { PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS } from 'src/engine/core-modules/permavent-sales-scope/constants/permavent-role-universal-identifiers.constant';
import { PermaventSalesScopeContextFactory } from 'src/engine/core-modules/permavent-sales-scope/context/permavent-sales-scope-context.factory';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';

describe('PermaventSalesScopeContextFactory', () => {
  const getOrRecompute = jest.fn();
  const findAllowedSalesRepCodes = jest.fn();
  const findPrimarySalesRepCode = jest.fn();
  const factory = new PermaventSalesScopeContextFactory(
    { getOrRecompute } as unknown as WorkspaceCacheService,
    {
      findAllowedSalesRepCodes,
      findPrimarySalesRepCode,
    } as unknown as PermaventSalesRepAssignmentService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should resolve a delegated API-key Sales Rep as the effective user', async () => {
    getOrRecompute.mockResolvedValue({
      flatRoleMaps: {
        universalIdentifierById: {
          'sales-rep-role-id': PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS.salesRep,
        },
      },
      userWorkspaceRoleMap: {},
    });
    findAllowedSalesRepCodes.mockResolvedValue(['DT']);
    findPrimarySalesRepCode.mockResolvedValue('DT');

    const authContext = {
      type: 'apiKey',
      workspace: { id: 'workspace-id' },
      apiKey: { id: 'api-key-id' },
      delegatedActor: {
        user: { id: 'user-id', email: 'Sales.Rep@Example.Test' },
        userWorkspaceId: 'user-workspace-id',
        workspaceMemberId: 'workspace-member-id',
        workspaceMember: { id: 'workspace-member-id' },
        roleId: 'sales-rep-role-id',
        roleUniversalIdentifier: PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS.salesRep,
        correlationId: 'correlation-id',
      },
    } as unknown as WorkspaceAuthContext;

    await expect(factory.create(authContext)).resolves.toEqual({
      authContextType: 'apiKey',
      workspaceId: 'workspace-id',
      workspaceMemberId: 'workspace-member-id',
      userEmail: 'sales.rep@example.test',
      roleUniversalIdentifier: PERMAVENT_ROLE_UNIVERSAL_IDENTIFIERS.salesRep,
      isSalesManager: false,
      isRestrictedSalesRep: true,
      allowedSalesRepCodes: ['DT'],
      primarySalesRepCode: 'DT',
      isSupportedUserContext: true,
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

  it('should reject a plain API-key context without a delegated actor', async () => {
    const authContext = {
      type: 'apiKey',
      workspace: { id: 'workspace-id' },
      apiKey: { id: 'api-key-id' },
    } as unknown as WorkspaceAuthContext;

    await expect(factory.create(authContext)).resolves.toEqual({
      authContextType: 'apiKey',
      workspaceId: null,
      workspaceMemberId: null,
      userEmail: null,
      roleUniversalIdentifier: null,
      isSalesManager: false,
      isRestrictedSalesRep: false,
      allowedSalesRepCodes: [],
      primarySalesRepCode: null,
      isSupportedUserContext: false,
    });
    expect(getOrRecompute).not.toHaveBeenCalled();
    expect(findAllowedSalesRepCodes).not.toHaveBeenCalled();
    expect(findPrimarySalesRepCode).not.toHaveBeenCalled();
  });
});
