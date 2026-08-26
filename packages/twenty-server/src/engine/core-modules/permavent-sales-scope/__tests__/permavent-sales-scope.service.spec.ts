import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { PermaventSalesScopeContextFactory } from 'src/engine/core-modules/permavent-sales-scope/context/permavent-sales-scope-context.factory';
import { type PermaventSalesScopeContext } from 'src/engine/core-modules/permavent-sales-scope/context/permavent-sales-scope-context.type';
import { PermaventSalesScopeService } from 'src/engine/core-modules/permavent-sales-scope/permavent-sales-scope.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const authContext = {} as WorkspaceAuthContext;

const createContext = (
  overrides: Partial<PermaventSalesScopeContext> = {},
): PermaventSalesScopeContext => ({
  authContextType: 'user',
  workspaceMemberId: 'workspace-member-id',
  userEmail: 'sales.rep@example.test',
  roleUniversalIdentifier: 'sales-rep-role-universal-identifier',
  isSalesManager: false,
  isRestrictedSalesRep: true,
  allowedSalesRepCodes: ['RT', 'DM'],
  primarySalesRepCode: 'DM',
  isSupportedUserContext: true,
  ...overrides,
});

describe('PermaventSalesScopeService', () => {
  const getConfigValue = jest.fn();
  const createSalesScopeContext = jest.fn();
  const service = new PermaventSalesScopeService(
    { get: getConfigValue } as unknown as TwentyConfigService,
    {
      create: createSalesScopeContext,
    } as unknown as PermaventSalesScopeContextFactory,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    getConfigValue.mockReturnValue(false);
  });

  it('should not resolve a scope when the feature is disabled', async () => {
    await expect(service.resolveErpSalesScope(authContext)).resolves.toEqual({
      mode: 'NONE',
      salesRepCodes: [],
    });

    expect(createSalesScopeContext).not.toHaveBeenCalled();
  });

  it('should return all Sales Reps for a Sales Manager', async () => {
    getConfigValue.mockReturnValue(true);
    createSalesScopeContext.mockResolvedValue(
      createContext({ isSalesManager: true, isRestrictedSalesRep: false }),
    );

    await expect(service.resolveErpSalesScope(authContext)).resolves.toEqual({
      mode: 'ALL',
      salesRepCodes: [],
    });
  });

  it('should return sorted assignments and the primary Sales Rep', async () => {
    getConfigValue.mockReturnValue(true);
    createSalesScopeContext.mockResolvedValue(createContext());

    await expect(service.resolveErpSalesScope(authContext)).resolves.toEqual({
      mode: 'ASSIGNED',
      salesRepCodes: ['DM', 'RT'],
      primarySalesRepCode: 'DM',
    });
  });

  it('should return no scope for an unsupported identity', async () => {
    getConfigValue.mockReturnValue(true);
    createSalesScopeContext.mockResolvedValue(
      createContext({ isSupportedUserContext: false }),
    );

    await expect(service.resolveErpSalesScope(authContext)).resolves.toEqual({
      mode: 'NONE',
      salesRepCodes: [],
    });
  });

  it('should expose actor context only when Weekly Sales Report is enabled', async () => {
    getConfigValue.mockImplementation(
      (key: string) => key === 'PERMAVENT_WEEKLY_SALES_REPORT_ENABLED',
    );
    createSalesScopeContext.mockResolvedValue(createContext());

    await expect(
      service.resolveLogicFunctionActorContext(authContext),
    ).resolves.toEqual({
      workspaceMemberId: 'workspace-member-id',
      userEmail: 'sales.rep@example.test',
      roleUniversalIdentifier: 'sales-rep-role-universal-identifier',
      isRestrictedSalesRep: true,
    });
  });
});
