import { Injectable } from '@nestjs/common';

import { type ObjectRecordFilter } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { PermaventSalesScopeContextFactory } from 'src/engine/core-modules/permavent-sales-scope/context/permavent-sales-scope-context.factory';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';

export const PERMAVENT_ACTIVE_SALES_REP_CODES_MARKER =
  '{{PERMAVENT_ACTIVE_SALES_REP_CODES}}';

const PERMAVENT_FOCUS_OBJECTS = new Set(['company', 'branch']);

@Injectable()
export class PermaventCompanyFocusFilterService {
  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly salesScopeContextFactory: PermaventSalesScopeContextFactory,
  ) {}

  async applyToFilter({
    filter,
    authContext,
    flatObjectMetadata,
  }: {
    filter?: ObjectRecordFilter;
    authContext: WorkspaceAuthContext;
    flatObjectMetadata: FlatObjectMetadata;
  }): Promise<ObjectRecordFilter | undefined> {
    if (
      !this.twentyConfigService.get('PERMAVENT_MY_COMPANIES_FOCUS_ENABLED') ||
      !PERMAVENT_FOCUS_OBJECTS.has(flatObjectMetadata.nameSingular) ||
      !this.containsMarker(filter)
    ) {
      return filter;
    }

    const salesScopeContext =
      await this.salesScopeContextFactory.create(authContext);

    if (
      !salesScopeContext.isSupportedUserContext ||
      !salesScopeContext.isRestrictedSalesRep
    ) {
      return filter;
    }

    return this.replaceMarker(filter, salesScopeContext.allowedSalesRepCodes);
  }

  private containsMarker(filter: ObjectRecordFilter | undefined): boolean {
    if (!filter) {
      return false;
    }

    if (this.isMarkerCondition(filter.erpsalesrepcode)) {
      return true;
    }

    return ['and', 'or'].some((operator) => {
      const conditions = filter[operator] as ObjectRecordFilter[] | undefined;

      return conditions?.some((condition) => this.containsMarker(condition));
    });
  }

  private replaceMarker(
    filter: ObjectRecordFilter | undefined,
    allowedSalesRepCodes: string[],
  ): ObjectRecordFilter | undefined {
    if (!filter) {
      return filter;
    }

    const result: ObjectRecordFilter = {};
    const hasMarkerCondition = this.isMarkerCondition(filter.erpsalesrepcode);

    for (const [key, value] of Object.entries(filter)) {
      if (key === 'erpsalesrepcode' && this.isMarkerCondition(value)) {
        if (allowedSalesRepCodes.length > 0) {
          result[key] = { in: allowedSalesRepCodes };
        }
        continue;
      }

      if ((key === 'and' || key === 'or') && Array.isArray(value)) {
        result[key] = value.map((condition) =>
          this.replaceMarker(condition, allowedSalesRepCodes),
        );
        continue;
      }

      result[key] = value;
    }

    if (hasMarkerCondition && allowedSalesRepCodes.length === 0) {
      return Object.keys(result).length === 0
        ? this.buildMatchNoneFilter()
        : { and: [result, this.buildMatchNoneFilter()] };
    }

    return result;
  }

  private isMarkerCondition(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const condition = value as Record<string, unknown>;

    return (
      condition.eq === PERMAVENT_ACTIVE_SALES_REP_CODES_MARKER ||
      condition.ilike === `%${PERMAVENT_ACTIVE_SALES_REP_CODES_MARKER}%`
    );
  }

  private buildMatchNoneFilter(): ObjectRecordFilter {
    return {
      and: [{ id: { is: 'NULL' } }, { id: { is: 'NOT_NULL' } }],
    };
  }
}
