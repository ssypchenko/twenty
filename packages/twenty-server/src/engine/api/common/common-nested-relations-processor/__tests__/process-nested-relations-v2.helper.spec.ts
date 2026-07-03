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
  const helper = new ProcessNestedRelationsV2Helper({
    applyToObjectRecordFilter,
  } as unknown as PermaventSecurityService);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
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

  it('should preserve security predicates when adding relation constraints', async () => {
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
      column: '"companyId"',
      ids: ['company-id'],
      relationType: RelationType.MANY_TO_ONE,
      perParentLimit: 10,
      parentRecordsCount: 1,
      aggregate: { branches: {} },
      sourceFieldName: 'branches',
      targetObjectNameSingular: 'branch',
    });

    expect(aggregateQueryBuilder.andWhere).toHaveBeenCalledWith(
      '"companyId" IN (:...ids)',
      { ids: ['company-id'] },
    );
    expect(referenceQueryBuilder.andWhere).toHaveBeenCalledWith(
      '"companyId" IN (:...ids)',
      { ids: ['company-id'] },
    );
    expect(result.relationResults).toEqual([{ id: 'branch-id' }]);
  });
});
