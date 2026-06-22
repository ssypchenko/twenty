import { type CommonQueryNames } from 'src/engine/api/common/types/common-query-args.type';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';

export type PermaventCommonQueryHookInput<TArgs> = {
  args: TArgs;
  operationName: CommonQueryNames;
  authContext: WorkspaceAuthContext;
  flatObjectMetadata: FlatObjectMetadata;
};
