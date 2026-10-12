import {
  type ApiKeyWorkspaceAuthContext,
  type WorkspaceAuthContext,
} from 'src/engine/core-modules/auth/types/workspace-auth-context.type';

export type DelegatedApiKeyWorkspaceAuthContext = ApiKeyWorkspaceAuthContext & {
  delegatedActor: NonNullable<ApiKeyWorkspaceAuthContext['delegatedActor']>;
};

export const isDelegatedApiKeyAuthContext = (
  context: WorkspaceAuthContext,
): context is DelegatedApiKeyWorkspaceAuthContext => {
  return context.type === 'apiKey' && context.delegatedActor !== undefined;
};
