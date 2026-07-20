import { resolveObjectsPermissionsFromAuthContext } from 'src/engine/twenty-orm/utils/resolve-objects-permissions-from-auth-context.util';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';

describe('resolveObjectsPermissionsFromAuthContext', () => {
  const workspaceId = 'workspace-id';
  const apiKeyId = 'api-key-id';
  const actorRoleId = 'actor-role-id';
  const apiKeyRoleId = 'api-key-role-id';
  const objectId = 'object-id';

  it('should intersect the API key and delegated actor permissions', () => {
    const result = resolveObjectsPermissionsFromAuthContext({
      authContext: {
        type: 'apiKey',
        workspace: { id: workspaceId },
        apiKey: { id: apiKeyId },
        delegatedActor: {
          roleId: actorRoleId,
          roleUniversalIdentifier: 'actor-role',
          user: { id: 'user-id', email: 'actor@example.test' },
          userWorkspaceId: 'user-workspace-id',
          workspaceMemberId: 'workspace-member-id',
          workspaceMember: { id: 'workspace-member-id' },
          correlationId: 'correlation-id',
        },
      } as unknown as WorkspaceAuthContext,
      apiKeyRoleMap: { [apiKeyId]: apiKeyRoleId },
      userWorkspaceRoleMap: {},
      rolesPermissions: {
        [apiKeyRoleId]: {
          [objectId]: {
            canReadObjectRecords: true,
            canUpdateObjectRecords: true,
            canSoftDeleteObjectRecords: true,
            canDestroyObjectRecords: false,
            restrictedFields: {
              confidential: { canRead: false, canUpdate: false },
            },
            rowLevelPermissionPredicates: [],
            rowLevelPermissionPredicateGroups: [],
          },
        },
        [actorRoleId]: {
          [objectId]: {
            canReadObjectRecords: true,
            canUpdateObjectRecords: false,
            canSoftDeleteObjectRecords: true,
            canDestroyObjectRecords: true,
            restrictedFields: {
              confidential: { canRead: null, canUpdate: true },
            },
            rowLevelPermissionPredicates: [],
            rowLevelPermissionPredicateGroups: [],
          },
        },
      },
    });

    expect(result?.[objectId]).toMatchObject({
      canReadObjectRecords: true,
      canUpdateObjectRecords: false,
      canSoftDeleteObjectRecords: true,
      canDestroyObjectRecords: false,
      restrictedFields: {
        confidential: { canRead: false, canUpdate: false },
      },
    });
  });
});
