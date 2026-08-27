import {
  type ObjectsPermissions,
  type ObjectsPermissionsByRoleId,
} from 'twenty-shared/types';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type UserWorkspaceRoleMap } from 'src/engine/metadata-modules/role-target/types/user-workspace-role-map';
import { computePermissionIntersection } from 'src/engine/twenty-orm/utils/compute-permission-intersection.util';
import { resolveRolePermissionConfig } from 'src/engine/twenty-orm/utils/resolve-role-permission-config.util';

export const resolveObjectsPermissionsFromAuthContext = ({
  authContext,
  userWorkspaceRoleMap,
  apiKeyRoleMap,
  rolesPermissions,
}: {
  authContext: WorkspaceAuthContext;
  userWorkspaceRoleMap: UserWorkspaceRoleMap;
  apiKeyRoleMap: Record<string, string>;
  rolesPermissions: ObjectsPermissionsByRoleId;
}): ObjectsPermissions | undefined => {
  const rolePermissionConfig = resolveRolePermissionConfig({
    authContext,
    userWorkspaceRoleMap,
    apiKeyRoleMap,
  });

  if (!rolePermissionConfig) {
    return undefined;
  }

  if ('shouldBypassPermissionChecks' in rolePermissionConfig) {
    return {};
  }

  if ('intersectionOf' in rolePermissionConfig) {
    return computePermissionIntersection(
      rolePermissionConfig.intersectionOf.map(
        (roleId) => rolesPermissions[roleId] ?? {},
      ),
    );
  }

  if (rolePermissionConfig.unionOf.length === 1) {
    return rolesPermissions[rolePermissionConfig.unionOf[0]] ?? {};
  }

  throw new Error(
    'Union permission resolution is not supported for multiple roles',
  );
};
