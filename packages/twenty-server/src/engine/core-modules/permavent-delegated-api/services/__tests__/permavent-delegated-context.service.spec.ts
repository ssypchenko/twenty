import { AuthException } from 'src/engine/core-modules/auth/auth.exception';
import { PermaventDelegatedContextService } from 'src/engine/core-modules/permavent-delegated-api/services/permavent-delegated-context.service';

const API_KEY_ID = '11111111-1111-4111-8111-111111111111';
const CORRELATION_ID = '22222222-2222-4222-8222-222222222222';

const createService = (enabled = true) => {
  const twentyConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'PERMAVENT_DELEGATED_API_CONTEXT_ENABLED') {
        return enabled;
      }

      return API_KEY_ID;
    }),
  };
  const workspaceCacheService = {
    getOrRecompute: jest.fn().mockResolvedValue({
      flatRoleMaps: { universalIdentifierById: { 'role-1': 'role-ui-1' } },
      flatWorkspaceMemberMaps: {
        idByUserId: { 'user-1': 'workspace-member-1' },
        byId: {
          'workspace-member-1': {
            id: 'workspace-member-1',
            name: { firstName: 'Test', lastName: 'User' },
          },
        },
      },
      userWorkspaceRoleMap: { 'user-workspace-1': 'role-1' },
    }),
  };
  const coreEntityCacheService = {
    get: jest.fn().mockResolvedValue({ id: 'user-1', disabled: false }),
  };
  const userWorkspaceRepository = {
    findOne: jest.fn().mockResolvedValue({
      id: 'user-workspace-1',
      userId: 'user-1',
      user: { email: 'actor@example.test', disabled: false },
    }),
  };

  return {
    service: new PermaventDelegatedContextService(
      twentyConfigService as never,
      workspaceCacheService as never,
      coreEntityCacheService as never,
      userWorkspaceRepository as never,
    ),
  };
};

const authContext = {
  apiKey: { id: API_KEY_ID },
  workspace: { id: 'workspace-1' },
};

describe('PermaventDelegatedContextService', () => {
  it('resolves an allowlisted API key to the delegated actor', async () => {
    const { service } = createService();

    const result = await service.resolveForRequest({
      authContext,
      headers: {
        'x-permavent-actor-email': 'actor@example.test',
        'x-correlation-id': CORRELATION_ID,
      },
    });

    expect(result.delegatedActor).toEqual(
      expect.objectContaining({
        userWorkspaceId: 'user-workspace-1',
        workspaceMemberId: 'workspace-member-1',
        roleId: 'role-1',
        correlationId: CORRELATION_ID,
      }),
    );
  });

  it('fails closed when an allowlisted API key omits the actor header', async () => {
    const { service } = createService();

    await expect(
      service.resolveForRequest({ authContext, headers: {} }),
    ).rejects.toBeInstanceOf(AuthException);
  });

  it('rejects delegated headers when the feature is disabled', async () => {
    const { service } = createService(false);

    await expect(
      service.resolveForRequest({
        authContext,
        headers: { 'x-permavent-actor-email': 'actor@example.test' },
      }),
    ).rejects.toBeInstanceOf(AuthException);
  });
});
