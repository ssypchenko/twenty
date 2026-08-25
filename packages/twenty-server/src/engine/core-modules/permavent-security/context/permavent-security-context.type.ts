import { type WorkspaceAuthContextType } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';

export type PermaventSecurityContext = {
  authContextType: WorkspaceAuthContextType;
  workspaceId: string | null;
  workspaceMemberId: string | null;
  userWorkspaceId: string | null;
  userEmail: string | null;
  roleId: string | null;
  roleUniversalIdentifier: string | null;
  roleLabel: string | null;
  bypassSecurity: boolean;
  isRestrictedSalesRep: boolean;
  allowedSalesRepCodes: string[];
  primarySalesRepCode: string | null;
  isSupportedUserContext: boolean;
};
