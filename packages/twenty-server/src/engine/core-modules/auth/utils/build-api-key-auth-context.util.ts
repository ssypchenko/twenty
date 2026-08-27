import { type RawAuthContext } from 'src/engine/core-modules/auth/types/raw-auth-context.type';
import { type ApiKeyWorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';

type ApiKeyAuthContextInput = {
  workspace: NonNullable<RawAuthContext['workspace']>;
  apiKey: NonNullable<RawAuthContext['apiKey']>;
  delegatedActor?: RawAuthContext['delegatedActor'];
};

export const buildApiKeyAuthContext = (
  input: ApiKeyAuthContextInput,
): ApiKeyWorkspaceAuthContext => {
  return {
    type: 'apiKey',
    workspace: input.workspace,
    apiKey: input.apiKey,
    delegatedActor: input.delegatedActor,
  };
};
