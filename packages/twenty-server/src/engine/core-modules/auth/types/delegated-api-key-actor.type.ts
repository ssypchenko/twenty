import { type FlatAuthContextUser } from 'src/engine/core-modules/auth/types/flat-auth-context-user.type';
import { type WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';

export type DelegatedApiKeyActor = {
  user: FlatAuthContextUser;
  userWorkspaceId: string;
  workspaceMemberId: string;
  workspaceMember: WorkspaceMemberWorkspaceEntity;
  roleId: string;
  roleUniversalIdentifier: string;
  correlationId: string;
};
