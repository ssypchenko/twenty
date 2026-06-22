import { Injectable } from '@nestjs/common';

import { type ObjectRecordFilter } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';
import { CommonQueryNames } from 'src/engine/api/common/types/common-query-args.type';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { PermaventSecurityContextFactory } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.factory';
import { PermaventAccessFilterBuilder } from 'src/engine/core-modules/permavent-security/filters/permavent-access-filter.builder';
import { type PermaventCommonQueryHookInput } from 'src/engine/core-modules/permavent-security/types/permavent-common-query-hook-input.type';
import { mergePermaventSecurityFilter } from 'src/engine/core-modules/permavent-security/utils/merge-permavent-security-filter.util';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';

const PERMAVENT_DIRECT_SALES_OBJECTS = new Set(['company', 'branch']);
const PERMAVENT_FILTERED_READ_OPERATIONS = new Set<CommonQueryNames>([
  CommonQueryNames.FIND_ONE,
  CommonQueryNames.FIND_MANY,
  CommonQueryNames.GROUP_BY,
]);

type QueryArgsWithFilter = {
  filter?: ObjectRecordFilter;
};

@Injectable()
export class PermaventSecurityService {
  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly securityContextFactory: PermaventSecurityContextFactory,
    private readonly accessFilterBuilder: PermaventAccessFilterBuilder,
  ) {}

  public async applyToCommonQueryArgs<TArgs>({
    args,
    operationName,
    authContext,
    flatObjectMetadata,
  }: PermaventCommonQueryHookInput<TArgs>): Promise<TArgs> {
    if (!PERMAVENT_FILTERED_READ_OPERATIONS.has(operationName)) {
      return args;
    }

    const queryArgs = args as TArgs & QueryArgsWithFilter;
    const filter = await this.applyToObjectRecordFilter({
      filter: queryArgs.filter,
      authContext,
      flatObjectMetadata,
    });

    if (filter === queryArgs.filter) {
      return args;
    }

    return {
      ...queryArgs,
      filter,
    };
  }

  public async applyToObjectRecordFilter({
    filter,
    authContext,
    flatObjectMetadata,
  }: {
    filter?: ObjectRecordFilter;
    authContext: WorkspaceAuthContext;
    flatObjectMetadata: FlatObjectMetadata;
  }): Promise<ObjectRecordFilter | undefined> {
    if (
      !this.twentyConfigService.get('PERMAVENT_SECURITY_RLS_ENABLED') ||
      !PERMAVENT_DIRECT_SALES_OBJECTS.has(flatObjectMetadata.nameSingular)
    ) {
      return filter;
    }

    const securityContext =
      await this.securityContextFactory.create(authContext);

    if (
      !securityContext.isSupportedUserContext ||
      securityContext.bypassSecurity ||
      !securityContext.isRestrictedSalesRep
    ) {
      return filter;
    }

    return mergePermaventSecurityFilter({
      callerFilter: filter,
      securityFilter:
        this.accessFilterBuilder.buildCompanyOrBranchFilter(securityContext),
    });
  }
}
