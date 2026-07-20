import { AuthExceptionCode } from 'src/engine/core-modules/auth/auth.exception';
import { type RawAuthContext } from 'src/engine/core-modules/auth/types/raw-auth-context.type';
import { type UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { type PermaventDelegatedAuditService } from 'src/engine/core-modules/permavent-security/audit/permavent-delegated-audit.service';
import { PermaventDelegatedContextService } from 'src/engine/core-modules/permavent-security/delegated-context/services/permavent-delegated-context.service';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { type CoreEntityCacheService } from 'src/engine/core-entity-cache/services/core-entity-cache.service';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { type Repository } from 'typeorm';

const API_KEY_ID = '016e0b71-e08f-4d46-8b36-2158670b46f4';
const WORKSPACE_ID = '1df70d5a-7f7a-4994-8c67-171178997e0e';
const USER_ID = '88bb77cb-2bc1-45c4-95b8-ce871adbb121';
const USER_WORKSPACE_ID = 'ddbb3cb0-3b9a-4562-a94e-0cfba3ca4fba';
const WORKSPACE_MEMBER_ID = '30237d32-2c91-4139-b361-1846ce77ea11';
const ROLE_ID = '910678aa-6b7a-457a-9ff5-205bf920ac2b';
const CORRELATION_ID = '1c5dfbb7-7d4f-4271-8c2f-dc96e187c5a6';

describe('PermaventDelegatedContextService', () => {
  const configGet = jest.fn();
  const getOrRecompute = jest.fn();
  const get = jest.fn();
  const findOne = jest.fn();
  const recordResolutionDenied = jest.fn();
  let service: PermaventDelegatedContextService;

  const authContext = {
    apiKey: { id: API_KEY_ID, name: 'Voice Notes' },
    workspace: { id: WORKSPACE_ID },
  } as RawAuthContext;

  beforeEach(() => {
    jest.clearAllMocks();
    configGet.mockImplementation((key: string) => {
      if (key === 'PERMAVENT_DELEGATED_API_CONTEXT_ENABLED') return true;

      if (key === 'PERMAVENT_DELEGATED_API_KEY_IDS') return API_KEY_ID;

      return undefined;
    });
    findOne.mockResolvedValue({
      id: USER_WORKSPACE_ID,
      userId: USER_ID,
      user: { id: USER_ID, disabled: false },
    } as UserWorkspaceEntity);
    get.mockResolvedValue({
      id: USER_ID,
      email: 'sales.rep@example.test',
      disabled: false,
    });
    getOrRecompute.mockResolvedValue({
      flatWorkspaceMemberMaps: {
        idByUserId: { [USER_ID]: WORKSPACE_MEMBER_ID },
        byId: {
          [WORKSPACE_MEMBER_ID]: {
            id: WORKSPACE_MEMBER_ID,
            name: { firstName: 'Sales', lastName: 'Rep' },
          },
        },
      },
      userWorkspaceRoleMap: { [USER_WORKSPACE_ID]: ROLE_ID },
      flatRoleMaps: {
        universalIdentifierById: { [ROLE_ID]: 'sales-rep-role' },
      },
    });
    service = new PermaventDelegatedContextService(
      { get: configGet } as unknown as TwentyConfigService,
      { getOrRecompute } as unknown as WorkspaceCacheService,
      { get } as unknown as CoreEntityCacheService,
      {
        recordResolutionDenied,
      } as unknown as PermaventDelegatedAuditService,
      { findOne } as unknown as Repository<UserWorkspaceEntity>,
    );
  });

  it('should resolve an allowlisted API key into a delegated actor context', async () => {
    const result = await service.resolveForRequest({
      authContext,
      headers: {
        'x-permavent-actor-email': ' Sales.Rep@Example.test ',
        'x-correlation-id': CORRELATION_ID,
      },
    });

    expect(findOne).toHaveBeenCalledWith({
      where: {
        workspaceId: WORKSPACE_ID,
        user: { email: 'sales.rep@example.test', disabled: false },
      },
      relations: { user: true },
    });
    expect(result.delegatedActor).toEqual({
      user: expect.objectContaining({ id: USER_ID }),
      userWorkspaceId: USER_WORKSPACE_ID,
      workspaceMemberId: WORKSPACE_MEMBER_ID,
      workspaceMember: expect.objectContaining({ id: WORKSPACE_MEMBER_ID }),
      roleId: ROLE_ID,
      roleUniversalIdentifier: 'sales-rep-role',
      correlationId: CORRELATION_ID,
    });
  });

  it('should preserve ordinary API-key behaviour when the feature is disabled and no actor header is present', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'PERMAVENT_DELEGATED_API_CONTEXT_ENABLED' ? false : API_KEY_ID,
    );

    await expect(
      service.resolveForRequest({ authContext, headers: {} }),
    ).resolves.toBe(authContext);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('should fail closed when an allowlisted API key omits the actor header', async () => {
    await expect(
      service.resolveForRequest({ authContext, headers: {} }),
    ).rejects.toMatchObject({ code: AuthExceptionCode.FORBIDDEN_EXCEPTION });
  });

  it('should reject an actor header when the feature is disabled', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'PERMAVENT_DELEGATED_API_CONTEXT_ENABLED' ? false : API_KEY_ID,
    );

    await expect(
      service.resolveForRequest({
        authContext,
        headers: { 'x-permavent-actor-email': 'sales.rep@example.test' },
      }),
    ).rejects.toMatchObject({ code: AuthExceptionCode.FORBIDDEN_EXCEPTION });
  });

  it('should reject an actor header without an API key context', async () => {
    await expect(
      service.resolveForRequest({
        authContext: {},
        headers: { 'x-permavent-actor-email': 'sales.rep@example.test' },
      }),
    ).rejects.toMatchObject({ code: AuthExceptionCode.FORBIDDEN_EXCEPTION });
  });

  it('should reject malformed actor emails before lookup', async () => {
    await expect(
      service.resolveForRequest({
        authContext,
        headers: { 'x-permavent-actor-email': 'not-an-email' },
      }),
    ).rejects.toMatchObject({ code: AuthExceptionCode.INVALID_INPUT });
    expect(findOne).not.toHaveBeenCalled();
  });

  it('should reject actors that are unavailable in the API key workspace', async () => {
    findOne.mockResolvedValue(null);

    await expect(
      service.resolveForRequest({
        authContext,
        headers: { 'x-permavent-actor-email': 'sales.rep@example.test' },
      }),
    ).rejects.toMatchObject({ code: AuthExceptionCode.FORBIDDEN_EXCEPTION });
    expect(recordResolutionDenied).toHaveBeenCalledWith({
      apiKeyPrincipalId: API_KEY_ID,
      workspaceId: WORKSPACE_ID,
      denialCategory: 'actor_unavailable',
    });
  });

  it('should reject a delegated actor header for an API key outside the allowlist', async () => {
    configGet.mockImplementation((key: string) => {
      if (key === 'PERMAVENT_DELEGATED_API_CONTEXT_ENABLED') return true;

      if (key === 'PERMAVENT_DELEGATED_API_KEY_IDS') {
        return '43d5f3d2-66d9-4a66-84d2-5d3551cc51dd';
      }

      return undefined;
    });

    await expect(
      service.resolveForRequest({
        authContext,
        headers: { 'x-permavent-actor-email': 'sales.rep@example.test' },
      }),
    ).rejects.toMatchObject({ code: AuthExceptionCode.FORBIDDEN_EXCEPTION });
    expect(findOne).not.toHaveBeenCalled();
  });
});
