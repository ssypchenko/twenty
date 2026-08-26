import { type WorkspaceAuthContextType } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';

export type PermaventSalesScopeContext = {
  authContextType: WorkspaceAuthContextType;
  workspaceId: string | null;
  workspaceMemberId: string | null;
  userEmail: string | null;
  roleUniversalIdentifier: string | null;
  isSalesManager: boolean;
  isRestrictedSalesRep: boolean;
  allowedSalesRepCodes: string[];
  primarySalesRepCode: string | null;
  isSupportedUserContext: boolean;
};
