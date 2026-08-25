import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';

import {
  type ObjectRecord,
  type PermaventLogicFunctionActorContext,
  type PermaventSalesScope,
} from 'twenty-shared/types';

import { type ObjectRecordFilter } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';
import {
  CommonQueryNames,
  type CreateManyQueryArgs,
  type CreateOneQueryArgs,
} from 'src/engine/api/common/types/common-query-args.type';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { PermaventSecurityContextFactory } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.factory';
import { PermaventAccessFilterBuilder } from 'src/engine/core-modules/permavent-security/filters/permavent-access-filter.builder';
import {
  PERMAVENT_ACTIVE_SALES_REP_CODES_MARKER,
  PermaventCompanyFocusFilterService,
} from 'src/engine/core-modules/permavent-security/focus/permavent-company-focus-filter.service';
import { type PermaventCommonQueryHookInput } from 'src/engine/core-modules/permavent-security/types/permavent-common-query-hook-input.type';
import { mergePermaventSecurityFilter } from 'src/engine/core-modules/permavent-security/utils/merge-permavent-security-filter.util';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { PermaventUserAuditService } from 'src/engine/core-modules/permavent-user-audit/permavent-user-audit.service';
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
const PERMAVENT_SALES_REP_CODE_MUTATION_OPERATIONS = new Set([
  CommonQueryNames.CREATE_ONE,
  CommonQueryNames.CREATE_MANY,
  CommonQueryNames.UPDATE_ONE,
  CommonQueryNames.UPDATE_MANY,
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
  private readonly logger = new Logger(PermaventSecurityService.name);
  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly securityContextFactory: PermaventSecurityContextFactory,
    private readonly accessFilterBuilder: PermaventAccessFilterBuilder,
    private readonly companyFocusFilterService: PermaventCompanyFocusFilterService,
    @Optional() private readonly userAuditService?: PermaventUserAuditService,
  ) {}

  public async resolveErpSalesScope(
    authContext: WorkspaceAuthContext,
  ): Promise<PermaventSalesScope> {
    if (!this.twentyConfigService.get('PERMAVENT_ERP_SALES_SCOPE_ENABLED')) {
      return { mode: 'NONE', salesRepCodes: [] };
    }

    const securityContext =
      await this.securityContextFactory.create(authContext);

    if (!securityContext.isSupportedUserContext) {
      return { mode: 'NONE', salesRepCodes: [] };
    }

    if (securityContext.bypassSecurity) {
      return { mode: 'ALL', salesRepCodes: [] };
    }

    if (
      !securityContext.isRestrictedSalesRep ||
      securityContext.allowedSalesRepCodes.length === 0
    ) {
      return { mode: 'NONE', salesRepCodes: [] };
    }

    return {
      mode: 'ASSIGNED',
      salesRepCodes: [...securityContext.allowedSalesRepCodes].sort(),
      primarySalesRepCode: securityContext.primarySalesRepCode,
    };
  }

  public async resolveLogicFunctionActorContext(
    authContext: WorkspaceAuthContext,
  ): Promise<PermaventLogicFunctionActorContext | null> {
    if (
      !this.twentyConfigService.get('PERMAVENT_WEEKLY_SALES_REPORT_ENABLED')
    ) {
      return null;
    }

    const securityContext =
      await this.securityContextFactory.create(authContext);

    if (
      !securityContext.isSupportedUserContext ||
      securityContext.workspaceMemberId === null ||
      securityContext.userEmail === null
    ) {
      return null;
    }

    return {
      workspaceMemberId: securityContext.workspaceMemberId,
      userEmail: securityContext.userEmail,
      roleUniversalIdentifier: securityContext.roleUniversalIdentifier,
      isRestrictedSalesRep: securityContext.isRestrictedSalesRep,
    };
  }

  public async applyToCommonQueryArgs<TArgs>({
    args,
    operationName,
    authContext,
    flatObjectMetadata,
  }: PermaventCommonQueryHookInput<TArgs>): Promise<TArgs> {
    if (
      PERMAVENT_DIRECT_SALES_OBJECTS.has(flatObjectMetadata.nameSingular) &&
      PERMAVENT_SALES_REP_CODE_MUTATION_OPERATIONS.has(operationName)
    ) {
      this.assertNoActiveSalesRepMarker(args);
    }

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
    const focusFilter = PERMAVENT_FILTERED_READ_OPERATIONS.has(operationName)
      ? await this.companyFocusFilterService.applyToFilter({
          filter: queryArgs.filter,
          authContext,
          flatObjectMetadata,
        })
      : queryArgs.filter;
    const filter = await this.applyToMutationFilter({
      filter: focusFilter,
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
      void this.recordDenied(
        authContext,
        flatObjectMetadata.nameSingular,
        'UPSERT_DENIED',
      );
      throw new PermissionsException(
        `Permavent Sales Rep upsert is not permitted on '${flatObjectMetadata.nameSingular}' records`,
        PermissionsExceptionCode.PERMISSION_DENIED,
      );
    }

    if (securityContext.workspaceMemberId === null) {
      void this.recordDenied(
        authContext,
        flatObjectMetadata.nameSingular,
        'OWNER_UNRESOLVED',
      );
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

  private assertNoActiveSalesRepMarker(args: unknown): void {
    const data = (args as { data?: unknown }).data;
    const records = Array.isArray(data) ? data : [data];

    if (
      records.some((record) => {
        if (!record || typeof record !== 'object') {
          return false;
        }

        const values = record as Record<string, unknown>;
        const salesRepCode = values.erpsalesrepcode ?? values.erpSalesRepCode;

        return (
          typeof salesRepCode === 'string' &&
          salesRepCode.includes(PERMAVENT_ACTIVE_SALES_REP_CODES_MARKER)
        );
      })
    ) {
      throw new BadRequestException(
        'The active Sales Rep marker cannot be stored in a Company or Branch record.',
      );
    }
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
    const isAssignmentObject =
      flatObjectMetadata.nameSingular === PERMAVENT_ASSIGNMENT_OBJECT;

    if (
      !isAssignmentObject &&
      (!this.twentyConfigService.get('PERMAVENT_SECURITY_RLS_ENABLED') ||
        !PERMAVENT_DIRECT_SALES_OBJECTS.has(flatObjectMetadata.nameSingular))
    ) {
      return;
    }

    const securityContext =
      await this.securityContextFactory.create(authContext);

    if (!securityContext.isRestrictedSalesRep) {
      return;
    }

    void this.recordDenied(
      authContext,
      flatObjectMetadata.nameSingular,
      isAssignmentObject
        ? 'SALES_REP_ASSIGNMENT_DENIED'
        : 'SALES_REP_OPERATION_DENIED',
    );

    throw new PermissionsException(
      `Permavent Sales Rep operation '${operationName}' is not permitted on '${flatObjectMetadata.nameSingular}' records`,
      PermissionsExceptionCode.PERMISSION_DENIED,
    );
  }

  private async recordDenied(
    authContext: WorkspaceAuthContext,
    objectName: string,
    category: string,
  ): Promise<void> {
    try {
      if (authContext.type !== 'user') return;
      await this.userAuditService?.recordRlsDenied({
        workspaceId: authContext.workspace.id,
        userWorkspaceId: authContext.userWorkspaceId,
        workspaceMemberId: authContext.workspaceMemberId,
        objectName,
        action: 'RLS_DENIED',
        category,
      });
    } catch (error) {
      // Audit availability must never change the RLS decision.
      this.logger.error('Permavent user audit denial recording failed', error);
    }
  }
}
