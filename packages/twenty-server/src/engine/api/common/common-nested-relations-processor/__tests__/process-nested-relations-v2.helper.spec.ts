import { type ObjectLiteral } from 'typeorm';

import { ProcessNestedRelationsV2Helper } from 'src/engine/api/common/common-nested-relations-processor/process-nested-relations-v2.helper';
import { GraphqlQueryParser } from 'src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query.parser';
import { ProcessAggregateHelper } from 'src/engine/api/graphql/graphql-query-runner/helpers/process-aggregate.helper';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type PermaventSecurityService } from 'src/engine/core-modules/permavent-security/permavent-security.service';
import { RelationType } from 'src/engine/metadata-modules/field-metadata/interfaces/relation-type.interface';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type WorkspaceRepository } from 'src/engine/twenty-orm/repository/workspace.repository';
import { type WorkspaceSelectQueryBuilder } from 'src/engine/twenty-orm/repository/workspace-select-query-builder';

describe('ProcessNestedRelationsV2Helper', () => {
  const applyToObjectRecordFilter = jest.fn();
  let helper: ProcessNestedRelationsV2Helper;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    helper = new ProcessNestedRelationsV2Helper({
      applyToObjectRecordFilter,
    } as unknown as PermaventSecurityService);
  });

  it('should apply a Permavent filter to a nested target query', async () => {
    const queryBuilder = {} as WorkspaceSelectQueryBuilder<ObjectLiteral>;
    const authContext = {
      type: 'user',
      workspace: { id: 'workspace-id' },
    } as WorkspaceAuthContext;
    const targetObjectMetadata = {
      nameSingular: 'branch',
      fieldIds: [],
    } as unknown as FlatObjectMetadata;
    const flatObjectMetadataMaps = {
      byUniversalIdentifier: {},
      universalIdentifierById: {},
      universalIdentifiersByApplicationId: {},
    } as FlatEntityMaps<FlatObjectMetadata>;
    const flatFieldMetadataMaps = {
      byUniversalIdentifier: {},
      universalIdentifierById: {},
      universalIdentifiersByApplicationId: {},
    } as FlatEntityMaps<FlatFieldMetadata>;
    const securityFilter = {
      erpsalesrepcode: { in: ['DM'] },
    };

    applyToObjectRecordFilter.mockResolvedValue(securityFilter);
    const applyFilterToBuilder = jest
      .spyOn(GraphqlQueryParser.prototype, 'applyFilterToBuilder')
      .mockImplementation((builder) => builder);

    await helper['applyPermaventSecurityFilter']({
      referenceQueryBuilder: queryBuilder,
      authContext,
      targetObjectMetadata,
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
    });

    expect(applyToObjectRecordFilter).toHaveBeenCalledWith({
      filter: {},
      authContext,
      flatObjectMetadata: targetObjectMetadata,
    });
    expect(applyFilterToBuilder).toHaveBeenCalledWith(
      queryBuilder,
      'branch',
      securityFilter,
    );
  });

  it.each(['companyId', 'branchId', 'customRelationId'])(
    'should qualify the %s relation column when preserving security predicates',
    async (columnName) => {
      const aggregateQueryBuilder = {
        addSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      const referenceQueryBuilder = {
        clone: jest.fn().mockReturnValue(aggregateQueryBuilder),
        getFindOptions: jest.fn().mockReturnValue({ select: { id: true } }),
        setFindOptions: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'branch-id' }]),
      };

      jest
        .spyOn(
          ProcessAggregateHelper,
          'addSelectedAggregatedFieldsQueriesToQueryBuilder',
        )
        .mockImplementation(() => undefined);

      const result = await helper['findRelations']({
        referenceQueryBuilder:
          referenceQueryBuilder as unknown as WorkspaceSelectQueryBuilder<ObjectLiteral>,
        targetObjectRepository: {} as WorkspaceRepository<ObjectLiteral>,
        columnName,
        ids: ['company-id'],
        relationType: RelationType.MANY_TO_ONE,
        perParentLimit: 10,
        parentRecordsCount: 1,
        aggregate: { branches: {} },
        sourceFieldName: 'branches',
        targetObjectNameSingular: 'branch',
      });

      const qualifiedColumn = `"branch"."${columnName}"`;

      expect(aggregateQueryBuilder.addSelect).toHaveBeenCalledWith(
        qualifiedColumn,
        columnName,
      );
      expect(aggregateQueryBuilder.andWhere).toHaveBeenCalledWith(
        `${qualifiedColumn} IN (:...ids)`,
        { ids: ['company-id'] },
      );
      expect(aggregateQueryBuilder.groupBy).toHaveBeenCalledWith(
        qualifiedColumn,
      );
      expect(referenceQueryBuilder.andWhere).toHaveBeenCalledWith(
        `${qualifiedColumn} IN (:...ids)`,
        { ids: ['company-id'] },
      );
      expect(result.relationResults).toEqual([{ id: 'branch-id' }]);
    },
  );

  it('should qualify the record identifier when hydrating one-to-many relations', async () => {
    const referenceQueryBuilder = {
      getFindOptions: jest.fn().mockReturnValue({ select: { id: true } }),
      setFindOptions: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    helper['findRelationRecordIdsLimitedPerParent'] = jest
      .fn()
      .mockResolvedValue([]);

    await helper['findRelations']({
      referenceQueryBuilder:
        referenceQueryBuilder as unknown as WorkspaceSelectQueryBuilder<ObjectLiteral>,
      targetObjectRepository: {} as WorkspaceRepository<ObjectLiteral>,
      columnName: 'companyId',
      ids: ['company-id'],
      relationType: RelationType.ONE_TO_MANY,
      perParentLimit: 10,
      parentRecordsCount: 1,
      aggregate: {},
      sourceFieldName: 'opportunities',
      targetObjectNameSingular: 'opportunity',
    });

    expect(referenceQueryBuilder.andWhere).toHaveBeenCalledWith(
      '"opportunity"."id" IN (:...recordIdsToHydrate)',
      {
        recordIdsToHydrate: ['00000000-0000-0000-0000-000000000000'],
      },
    );
  });

  it('should qualify identifiers in the per-parent relation query', async () => {
    const perParentQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getQuery: jest.fn().mockReturnValue('SELECT relation ids'),
    };
    const limitedRecordsQueryBuilder = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      expressionMap: { aliases: [] },
      getRawMany: jest.fn().mockResolvedValue([{ id: 'person-id' }]),
    };
    const targetObjectRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(perParentQueryBuilder)
        .mockReturnValueOnce(limitedRecordsQueryBuilder),
    } as unknown as WorkspaceRepository<ObjectLiteral>;

    const result = await helper['findRelationRecordIdsLimitedPerParent']({
      targetObjectRepository,
      targetObjectNameSingular: 'person',
      columnName: 'companyId',
      ids: ['9d395568-9119-46b4-8d2a-1d58d71c076b'],
      perParentLimit: 10,
    });

    expect(perParentQueryBuilder.select).toHaveBeenCalledWith(
      '"person"."id"',
      'id',
    );
    expect(perParentQueryBuilder.where).toHaveBeenCalledWith(
      '"person"."companyId" = "lateralParents"."parentId"',
    );
    expect(result).toEqual(['person-id']);
  });
});
