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
import {
  PermissionsException,
  PermissionsExceptionCode,
} from 'src/engine/metadata-modules/permissions/permissions.exception';

const PERMAVENT_DIRECT_SALES_OBJECTS = new Set(['company', 'branch']);
const PERMAVENT_FILTERED_READ_OPERATIONS = new Set<CommonQueryNames>([
  CommonQueryNames.FIND_ONE,
  CommonQueryNames.FIND_MANY,
  CommonQueryNames.GROUP_BY,
]);
const PERMAVENT_DENIED_SALES_REP_OPERATIONS = new Set<CommonQueryNames>([
  CommonQueryNames.CREATE_ONE,
  CommonQueryNames.CREATE_MANY,
  CommonQueryNames.UPDATE_ONE,
  CommonQueryNames.UPDATE_MANY,
  CommonQueryNames.DELETE_ONE,
  CommonQueryNames.DELETE_MANY,
  CommonQueryNames.DESTROY_ONE,
  CommonQueryNames.DESTROY_MANY,
  CommonQueryNames.RESTORE_ONE,
  CommonQueryNames.RESTORE_MANY,
  CommonQueryNames.MERGE_MANY,
  CommonQueryNames.FIND_DUPLICATES,
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
    if (PERMAVENT_DENIED_SALES_REP_OPERATIONS.has(operationName)) {
      await this.assertOperationAllowed({
        operationName,
        authContext,
        flatObjectMetadata,
      });

      return args;
    }

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

  private async assertOperationAllowed({
    operationName,
    authContext,
    flatObjectMetadata,
  }: {
    operationName: CommonQueryNames;
    authContext: WorkspaceAuthContext;
    flatObjectMetadata: FlatObjectMetadata;
  }): Promise<void> {
    if (
      !this.twentyConfigService.get('PERMAVENT_SECURITY_RLS_ENABLED') ||
      !PERMAVENT_DIRECT_SALES_OBJECTS.has(flatObjectMetadata.nameSingular)
    ) {
      return;
    }

    const securityContext =
      await this.securityContextFactory.create(authContext);

    if (!securityContext.isRestrictedSalesRep) {
      return;
    }

    throw new PermissionsException(
      `Permavent Sales Rep operation '${operationName}' is not permitted on '${flatObjectMetadata.nameSingular}' records`,
      PermissionsExceptionCode.PERMISSION_DENIED,
    );
  }
}
