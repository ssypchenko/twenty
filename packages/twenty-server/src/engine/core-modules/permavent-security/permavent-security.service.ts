import { Injectable } from '@nestjs/common';

import { type ObjectRecord } from 'twenty-shared/types';

import { type ObjectRecordFilter } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';
import {
  CommonQueryNames,
  type CreateManyQueryArgs,
  type CreateOneQueryArgs,
} from 'src/engine/api/common/types/common-query-args.type';
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
const PERMAVENT_RELATED_SALES_OBJECTS = new Set(['person', 'opportunity']);
const PERMAVENT_ASSIGNMENT_OBJECT = 'salesrepassignment';
const PERMAVENT_FILTERED_READ_OBJECTS = new Set([
  ...PERMAVENT_DIRECT_SALES_OBJECTS,
  ...PERMAVENT_RELATED_SALES_OBJECTS,
]);
const PERMAVENT_FILTERED_READ_OPERATIONS = new Set<CommonQueryNames>([
  CommonQueryNames.FIND_ONE,
  CommonQueryNames.FIND_MANY,
  CommonQueryNames.FIND_DUPLICATES,
  CommonQueryNames.GROUP_BY,
]);
const PERMAVENT_FILTERED_MUTATION_OPERATIONS = new Set<CommonQueryNames>([
  CommonQueryNames.UPDATE_MANY,
  CommonQueryNames.DELETE_MANY,
]);
const PERMAVENT_DENIED_SALES_REP_OPERATIONS = new Set<CommonQueryNames>([
  CommonQueryNames.DESTROY_ONE,
  CommonQueryNames.DESTROY_MANY,
  CommonQueryNames.RESTORE_ONE,
  CommonQueryNames.RESTORE_MANY,
  CommonQueryNames.MERGE_MANY,
]);
const PERMAVENT_DENIED_SALES_REP_ASSIGNMENT_OPERATIONS = new Set([
  CommonQueryNames.CREATE_ONE,
  CommonQueryNames.CREATE_MANY,
  CommonQueryNames.UPDATE_ONE,
  CommonQueryNames.UPDATE_MANY,
  CommonQueryNames.DELETE_ONE,
  CommonQueryNames.DELETE_MANY,
  ...PERMAVENT_DENIED_SALES_REP_OPERATIONS,
  CommonQueryNames.FIND_ONE,
  CommonQueryNames.FIND_MANY,
  CommonQueryNames.FIND_DUPLICATES,
  CommonQueryNames.GROUP_BY,
]);

export const PERMAVENT_SYSTEM_FIELD_NAMES = Symbol('permaventSystemFieldNames');

type QueryArgsWithFilter = {
  filter?: ObjectRecordFilter;
};

type CreateQueryArgs = CreateOneQueryArgs | CreateManyQueryArgs;
type CreateQueryArgsWithSystemFields = CreateQueryArgs & {
  [PERMAVENT_SYSTEM_FIELD_NAMES]?: string[];
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
    if (
      flatObjectMetadata.nameSingular === PERMAVENT_ASSIGNMENT_OBJECT &&
      PERMAVENT_DENIED_SALES_REP_ASSIGNMENT_OPERATIONS.has(operationName)
    ) {
      await this.assertOperationAllowed({
        operationName,
        authContext,
        flatObjectMetadata,
      });

      return args;
    }

    if (PERMAVENT_DENIED_SALES_REP_OPERATIONS.has(operationName)) {
      await this.assertOperationAllowed({
        operationName,
        authContext,
        flatObjectMetadata,
      });

      return args;
    }

    if (
      (operationName === CommonQueryNames.CREATE_ONE ||
        operationName === CommonQueryNames.CREATE_MANY) &&
      PERMAVENT_DIRECT_SALES_OBJECTS.has(flatObjectMetadata.nameSingular)
    ) {
      return await this.applyCreateOwnershipDefault({
        args: args as TArgs & CreateQueryArgs,
        authContext,
        flatObjectMetadata,
      });
    }

    if (
      !PERMAVENT_FILTERED_READ_OPERATIONS.has(operationName) &&
      !PERMAVENT_FILTERED_MUTATION_OPERATIONS.has(operationName)
    ) {
      return args;
    }

    const queryArgs = args as TArgs & QueryArgsWithFilter;
    const filter = await this.applyToMutationFilter({
      filter: queryArgs.filter,
      operationName,
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
      !PERMAVENT_FILTERED_READ_OBJECTS.has(flatObjectMetadata.nameSingular)
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
      securityFilter: PERMAVENT_RELATED_SALES_OBJECTS.has(
        flatObjectMetadata.nameSingular,
      )
        ? this.accessFilterBuilder.buildRelatedCompanyOrBranchFilter(
            securityContext,
          )
        : this.accessFilterBuilder.buildCompanyOrBranchFilter(securityContext),
    });
  }

  public async applyToMutationFilter({
    filter,
    operationName,
    authContext,
    flatObjectMetadata,
  }: {
    filter?: ObjectRecordFilter;
    operationName: CommonQueryNames;
    authContext: WorkspaceAuthContext;
    flatObjectMetadata: FlatObjectMetadata;
  }): Promise<ObjectRecordFilter | undefined> {
    const securedFilter = await this.applyToObjectRecordFilter({
      filter,
      authContext,
      flatObjectMetadata,
    });

    if (
      operationName !== CommonQueryNames.DELETE_ONE &&
      operationName !== CommonQueryNames.DELETE_MANY
    ) {
      return securedFilter;
    }

    if (!PERMAVENT_DIRECT_SALES_OBJECTS.has(flatObjectMetadata.nameSingular)) {
      return securedFilter;
    }

    if (!this.twentyConfigService.get('PERMAVENT_SECURITY_RLS_ENABLED')) {
      return securedFilter;
    }

    const securityContext =
      await this.securityContextFactory.create(authContext);

    if (
      !securityContext.isSupportedUserContext ||
      securityContext.bypassSecurity ||
      !securityContext.isRestrictedSalesRep
    ) {
      return securedFilter;
    }

    return mergePermaventSecurityFilter({
      callerFilter: securedFilter,
      securityFilter: { erpsalesrepcode: { is: 'NULL' } },
    });
  }

  private async applyCreateOwnershipDefault<
    TArgs extends CreateQueryArgsWithSystemFields,
  >({
    args,
    authContext,
    flatObjectMetadata,
  }: {
    args: TArgs;
    authContext: WorkspaceAuthContext;
    flatObjectMetadata: FlatObjectMetadata;
  }): Promise<TArgs> {
    if (!this.twentyConfigService.get('PERMAVENT_SECURITY_RLS_ENABLED')) {
      return args;
    }

    const securityContext =
      await this.securityContextFactory.create(authContext);

    if (!securityContext.isRestrictedSalesRep) {
      return args;
    }

    if (args.upsert) {
      throw new PermissionsException(
        `Permavent Sales Rep upsert is not permitted on '${flatObjectMetadata.nameSingular}' records`,
        PermissionsExceptionCode.PERMISSION_DENIED,
      );
    }

    if (securityContext.workspaceMemberId === null) {
      throw new PermissionsException(
        'Permavent Sales Rep ownership could not be resolved',
        PermissionsExceptionCode.PERMISSION_DENIED,
      );
    }

    const applyDefault = (record: Partial<ObjectRecord>) => ({
      ...record,
      accountOwnerId: securityContext.workspaceMemberId,
    });

    if (Array.isArray(args.data)) {
      return {
        ...args,
        data: args.data.map(applyDefault),
        [PERMAVENT_SYSTEM_FIELD_NAMES]: ['accountOwnerId'],
      } as TArgs;
    }

    return {
      ...args,
      data: applyDefault(args.data),
      [PERMAVENT_SYSTEM_FIELD_NAMES]: ['accountOwnerId'],
    } as TArgs;
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
      (!PERMAVENT_DIRECT_SALES_OBJECTS.has(flatObjectMetadata.nameSingular) &&
        flatObjectMetadata.nameSingular !== PERMAVENT_ASSIGNMENT_OBJECT)
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
