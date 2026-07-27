import { Test, type TestingModule } from '@nestjs/testing';
import { Brackets } from 'typeorm';

import { GraphqlQueryParser } from 'src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query.parser';
import { encodeCursorData } from 'src/engine/api/graphql/graphql-query-runner/utils/cursors.util';
import { type ObjectRecordFilter } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';
import {
  mockFlatFieldMetadataMaps,
  mockFlatObjectMetadatas,
} from 'src/engine/core-modules/__mocks__/mockFlatObjectMetadatas';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { FileUrlService } from 'src/engine/core-modules/file/file-url/file-url.service';
import { PermaventSecurityService } from 'src/engine/core-modules/permavent-security/permavent-security.service';
import { type ObjectRecordFilterInput } from 'src/engine/core-modules/search/dtos/object-record-filter-input';
import { SearchService } from 'src/engine/core-modules/search/services/search.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import {
  type ORMWorkspaceContext,
  withWorkspaceContext,
} from 'src/engine/twenty-orm/storage/orm-workspace-context.storage';

describe('SearchService', () => {
  let service: SearchService;
  const authContext = {
    type: 'system',
    workspace: { id: 'workspace-id' },
  } as WorkspaceAuthContext;
  const getRepository = jest.fn();
  const applyToObjectRecordFilter = jest.fn();
  const executeInWorkspaceContext = jest.fn(
    async (callback: () => Promise<unknown>) =>
      withWorkspaceContext(
        {
          authContext,
          userWorkspaceRoleMap: {},
          apiKeyRoleMap: {},
        } as ORMWorkspaceContext,
        callback,
      ),
  );

  beforeEach(async () => {
    jest.clearAllMocks();
    getRepository.mockResolvedValue({});
    applyToObjectRecordFilter.mockImplementation(
      async ({ filter }: { filter: ObjectRecordFilter }) => filter,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: GlobalWorkspaceOrmManager,
          useValue: { executeInWorkspaceContext, getRepository },
        },
        { provide: FileUrlService, useValue: {} },
        {
          provide: PermaventSecurityService,
          useValue: { applyToObjectRecordFilter },
        },
        {
          provide: TwentyConfigService,
          useValue: {
            get: (key: string) =>
              key === 'SEARCH_ILIKE_FALLBACK_TIMEOUT_MS' ? 500 : false,
          },
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should apply the Permavent filter before building a search query', async () => {
    const securityFilter = {
      erpsalesrepcode: { in: ['DM'] },
    };

    applyToObjectRecordFilter.mockResolvedValue(securityFilter);
    jest
      .spyOn(service, 'buildSearchQueryAndGetRecordsWithFallback')
      .mockResolvedValue([]);

    await service.getAllRecordsWithObjectMetadataItems({
      flatObjectMetadatas: [mockFlatObjectMetadatas[1]],
      flatFieldMetadataMaps: mockFlatFieldMetadataMaps,
      includedObjectNameSingulars: ['company'],
      excludedObjectNameSingulars: [],
      searchInput: 'example',
      limit: 10,
      workspaceId: 'workspace-id',
    });

    expect(applyToObjectRecordFilter).toHaveBeenCalledWith({
      filter: {},
      authContext,
      flatObjectMetadata: mockFlatObjectMetadatas[1],
    });
    expect(
      service.buildSearchQueryAndGetRecordsWithFallback,
    ).toHaveBeenCalledWith(expect.objectContaining({ filter: securityFilter }));
  });

  describe('joined ownership filters', () => {
    const opportunityMetadata = {
      ...mockFlatObjectMetadatas[2],
      nameSingular: 'opportunity',
      namePlural: 'opportunities',
      labelSingular: 'Opportunity',
      labelPlural: 'Opportunities',
    };
    const joinedOwnershipFilter = {
      or: [
        { company: { id: { eq: 'company-id' } } },
        { branch: { id: { eq: 'branch-id' } } },
      ],
    } as unknown as ObjectRecordFilterInput;

    const createQueryBuilderMock = () => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    });

    beforeEach(() => {
      jest
        .spyOn(GraphqlQueryParser.prototype, 'applyFilterToBuilder')
        .mockImplementation((queryBuilder) => queryBuilder);
      jest
        .spyOn(GraphqlQueryParser.prototype, 'applyDeletedAtToBuilder')
        .mockImplementation((queryBuilder) => queryBuilder);
    });

    it.each([
      {
        objectAlias: 'person',
        flatObjectMetadata: mockFlatObjectMetadatas[0],
        expectedFields: ['id', 'nameFirstName', 'nameLastName', 'avatarFile'],
      },
      {
        objectAlias: 'opportunity',
        flatObjectMetadata: opportunityMetadata,
        expectedFields: ['id', 'name', 'imageIdentifierFieldName'],
      },
    ])(
      'should qualify $objectAlias tsvector search columns when ownership adds joins',
      async ({ objectAlias, flatObjectMetadata, expectedFields }) => {
        const queryBuilder = createQueryBuilderMock();
        const entityManager = {
          createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
          internalContext: { flatObjectMetadataMaps: {} },
        };

        await service.buildSearchQueryAndGetRecords({
          entityManager: entityManager as never,
          flatObjectMetadata,
          flatFieldMetadataMaps: mockFlatFieldMetadataMaps,
          searchTerms: '',
          searchTermsOr: '',
          limit: 10,
          filter: joinedOwnershipFilter,
        });

        expect(queryBuilder.select).toHaveBeenCalledWith(
          expectedFields.map((field) => `"${objectAlias}"."${field}"`),
        );
        expect(queryBuilder.addSelect).toHaveBeenCalledWith(
          expect.stringContaining(`"${objectAlias}"."searchVector"`),
          'tsRankCD',
        );
        expect(queryBuilder.addSelect).toHaveBeenCalledWith(
          expect.stringContaining(`"${objectAlias}"."searchVector"`),
          'tsRank',
        );
        expect(queryBuilder.addOrderBy).toHaveBeenCalledWith(
          `"${objectAlias}"."id"`,
          'ASC',
          'NULLS FIRST',
        );

        const searchVectorBrackets = queryBuilder.andWhere.mock
          .calls[0][0] as Brackets;
        const whereBuilder = {
          where: jest.fn().mockReturnThis(),
        };

        searchVectorBrackets.whereFactory(whereBuilder as never);

        expect(whereBuilder.where).toHaveBeenCalledWith(
          `"${objectAlias}"."searchVector" IS NOT NULL`,
        );
      },
    );

    it.each([
      {
        objectAlias: 'person',
        flatObjectMetadata: mockFlatObjectMetadatas[0],
      },
      {
        objectAlias: 'opportunity',
        flatObjectMetadata: opportunityMetadata,
      },
    ])(
      'should qualify $objectAlias ILIKE fallback columns when ownership adds joins',
      async ({ objectAlias, flatObjectMetadata }) => {
        const tsvectorQueryBuilder = createQueryBuilderMock();
        const fallbackQueryBuilder = createQueryBuilderMock();
        const queryRunner = { query: jest.fn().mockResolvedValue([]) };
        const entityManager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValueOnce(tsvectorQueryBuilder)
            .mockReturnValueOnce(fallbackQueryBuilder),
          internalContext: {
            flatObjectMetadataMaps: {},
            workspaceId: 'workspace-id',
          },
          manager: {
            transaction: jest.fn(
              async (callback: (manager: unknown) => Promise<unknown>) =>
                callback({ queryRunner }),
            ),
          },
        };

        await service.buildSearchQueryAndGetRecordsWithFallback({
          entityManager: entityManager as never,
          flatObjectMetadata,
          flatFieldMetadataMaps: mockFlatFieldMetadataMaps,
          searchInput: 'example',
          searchTerms: 'example',
          searchTermsOr: 'example',
          limit: 10,
          filter: joinedOwnershipFilter,
        });

        expect(fallbackQueryBuilder.andWhere).toHaveBeenCalledWith(
          `public.unaccent_immutable("${objectAlias}"."searchVector"::text) ILIKE public.unaccent_immutable(:ilikeFallback0)`,
          { ilikeFallback0: '%example%' },
        );
        expect(fallbackQueryBuilder.orderBy).toHaveBeenCalledWith(
          `"${objectAlias}"."id"`,
          'ASC',
        );
      },
    );

    it('should qualify the Opportunity id in cursor tie-breaking', () => {
      const cursorCondition = service.computeCursorWhereCondition({
        after: encodeCursorData({
          lastRanks: { tsRankCD: 1, tsRank: 1 },
          lastRecordIdsPerObject: { opportunity: 'opportunity-id' },
        }),
        objectMetadataNameSingular: 'opportunity',
        tsRankExpr: 'ts-rank-expression',
        tsRankCDExpr: 'ts-rank-cd-expression',
      });
      const outerBuilder = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
      };

      cursorCondition?.whereFactory(outerBuilder as never);

      const idTieBreakerBrackets = outerBuilder.orWhere.mock
        .calls[1][0] as Brackets;
      const innerBuilder = {
        andWhere: jest.fn().mockReturnThis(),
      };

      idTieBreakerBrackets.whereFactory(innerBuilder as never);

      expect(innerBuilder.andWhere).toHaveBeenCalledWith(
        '"opportunity"."id" > :lastRecordId',
        { lastRecordId: 'opportunity-id' },
      );
    });
  });

  describe('filterObjectMetadataItems', () => {
    it('should return searchable object metadata items', () => {
      const objectMetadataItems = service.filterObjectMetadataItems({
        flatObjectMetadatas: mockFlatObjectMetadatas,
        includedObjectNameSingulars: [],
        excludedObjectNameSingulars: [],
      });

      expect(objectMetadataItems).toEqual([
        mockFlatObjectMetadatas[0],
        mockFlatObjectMetadatas[1],
        mockFlatObjectMetadatas[2],
      ]);
    });
    it('should return searchable object metadata items without excluded ones', () => {
      const objectMetadataItems = service.filterObjectMetadataItems({
        flatObjectMetadatas: mockFlatObjectMetadatas,
        includedObjectNameSingulars: [],
        excludedObjectNameSingulars: ['company'],
      });

      expect(objectMetadataItems).toEqual([
        mockFlatObjectMetadatas[0],
        mockFlatObjectMetadatas[2],
      ]);
    });
    it('should return searchable object metadata items with included ones only', () => {
      const objectMetadataItems = service.filterObjectMetadataItems({
        flatObjectMetadatas: mockFlatObjectMetadatas,
        includedObjectNameSingulars: ['company'],
        excludedObjectNameSingulars: [],
      });

      expect(objectMetadataItems).toEqual([mockFlatObjectMetadatas[1]]);
    });
    it('should allow non-searchable objects when explicitly included', () => {
      const objectMetadataItems = service.filterObjectMetadataItems({
        flatObjectMetadatas: mockFlatObjectMetadatas,
        includedObjectNameSingulars: ['non-searchable-object'],
        excludedObjectNameSingulars: [],
      });

      expect(objectMetadataItems).toEqual([mockFlatObjectMetadatas[3]]);
    });
    it('should block objects with channel visibility constraints even when explicitly included', () => {
      const objectMetadataItems = service.filterObjectMetadataItems({
        flatObjectMetadatas: mockFlatObjectMetadatas,
        includedObjectNameSingulars: ['message'],
        excludedObjectNameSingulars: [],
      });

      expect(objectMetadataItems).toEqual([]);
    });
  });

  describe('getLabelIdentifierColumns', () => {
    it('should return the two label identifier columns for a person object metadata item', () => {
      const labelIdentifierColumns = service.getLabelIdentifierColumns(
        mockFlatObjectMetadatas[0],
        mockFlatFieldMetadataMaps,
      );

      expect(labelIdentifierColumns).toEqual(['nameFirstName', 'nameLastName']);
    });
    it('should return the label identifier column for a regular object metadata item', () => {
      const labelIdentifierColumns = service.getLabelIdentifierColumns(
        mockFlatObjectMetadatas[1],
        mockFlatFieldMetadataMaps,
      );

      expect(labelIdentifierColumns).toEqual(['name']);
    });
  });

  describe('getImageIdentifierColumns', () => {
    it('should return the FILES image identifier column for a person object metadata item', () => {
      const imageIdentifierColumns = service.getImageIdentifierColumns(
        mockFlatObjectMetadatas[0],
        mockFlatFieldMetadataMaps,
      );

      expect(imageIdentifierColumns).toEqual(['avatarFile']);
    });
    it('should select only the primaryLinkUrl column of the composite LINKS image identifier for a company object metadata item', () => {
      const imageIdentifierColumns = service.getImageIdentifierColumns(
        mockFlatObjectMetadatas[1],
        mockFlatFieldMetadataMaps,
      );

      expect(imageIdentifierColumns).toEqual(['domainNamePrimaryLinkUrl']);
    });

    it('should return the non-composite image identifier column for a regular object metadata item', () => {
      const imageIdentifierColumns = service.getImageIdentifierColumns(
        mockFlatObjectMetadatas[2],
        mockFlatFieldMetadataMaps,
      );

      expect(imageIdentifierColumns).toEqual(['imageIdentifierFieldName']);
    });
  });

  describe('sortSearchObjectResults', () => {
    it('should sort the search object results by tsRankCD', () => {
      const objectResults = [
        {
          objectNameSingular: 'person',
          objectLabelSingular: 'Person',
          tsRankCD: 2,
          tsRank: 1,
          recordId: '',
          label: '',
          imageUrl: '',
        },
        {
          objectNameSingular: 'company',
          objectLabelSingular: 'Company',
          tsRankCD: 1,
          tsRank: 1,
          recordId: '',
          label: '',
          imageUrl: '',
        },
        {
          objectNameSingular: 'regular-custom-object',
          objectLabelSingular: 'Regular Custom Object',
          tsRankCD: 3,
          tsRank: 1,
          recordId: '',
          label: '',
          imageUrl: '',
        },
      ];

      expect(service.sortSearchObjectResults([...objectResults])).toEqual([
        objectResults[2],
        objectResults[0],
        objectResults[1],
      ]);
    });

    it('should sort the search object results by tsRank, if tsRankCD is the same', () => {
      const objectResults = [
        {
          objectNameSingular: 'person',
          objectLabelSingular: 'Person',
          tsRankCD: 1,
          tsRank: 1,
          recordId: '',
          label: '',
          imageUrl: '',
        },
        {
          objectNameSingular: 'company',
          objectLabelSingular: 'Company',
          tsRankCD: 1,
          tsRank: 2,
          recordId: '',
          label: '',
          imageUrl: '',
        },
        {
          objectNameSingular: 'regular-custom-object',
          objectLabelSingular: 'Regular Custom Object',
          tsRankCD: 1,
          tsRank: 3,
          recordId: '',
          label: '',
          imageUrl: '',
        },
      ];

      expect(service.sortSearchObjectResults([...objectResults])).toEqual([
        objectResults[2],
        objectResults[1],
        objectResults[0],
      ]);
    });

    it('should sort the search object results by priority rank, if tsRankCD and tsRank are the same', () => {
      const objectResults = [
        {
          objectNameSingular: 'company',
          objectLabelSingular: 'Company',
          tsRankCD: 1,
          tsRank: 1,
          recordId: '',
          label: '',
          imageUrl: '',
        },
        {
          objectNameSingular: 'person',
          objectLabelSingular: 'Person',
          tsRankCD: 1,
          tsRank: 1,
          recordId: '',
          label: '',
          imageUrl: '',
        },
        {
          objectNameSingular: 'regular-custom-object',
          objectLabelSingular: 'Regular Custom Object',
          tsRankCD: 1,
          tsRank: 1,
          recordId: '',
          label: '',
          imageUrl: '',
        },
      ];

      expect(service.sortSearchObjectResults([...objectResults])).toEqual([
        objectResults[1],
        objectResults[0],
        objectResults[2],
      ]);
    });
  });

  describe('computeEdges', () => {
    it('should compute edges properly', () => {
      const sortedSlicedRecords = [
        {
          record: {
            objectNameSingular: 'company',
            objectLabelSingular: 'Company',
            tsRankCD: 0.9,
            tsRank: 0.9,
            recordId: 'companyId1',
            label: '',
            imageUrl: '',
          },
          expectedCursor: encodeCursorData({
            lastRanks: { tsRankCD: 0.9, tsRank: 0.9 },
            lastRecordIdsPerObject: {
              company: 'companyId1',
            },
          }),
        },
        {
          record: {
            objectNameSingular: 'company',
            objectLabelSingular: 'Company',
            tsRankCD: 0.89,
            tsRank: 0.89,
            recordId: 'companyId2',
            label: '',
            imageUrl: '',
          },
          expectedCursor: encodeCursorData({
            lastRanks: { tsRankCD: 0.89, tsRank: 0.89 },
            lastRecordIdsPerObject: {
              company: 'companyId2',
            },
          }),
        },
        {
          record: {
            objectNameSingular: 'person',
            objectLabelSingular: 'Person',
            tsRankCD: 0.87,
            tsRank: 0.87,
            recordId: 'personId1',
            label: '',
            imageUrl: '',
          },
          expectedCursor: encodeCursorData({
            lastRanks: { tsRankCD: 0.87, tsRank: 0.87 },
            lastRecordIdsPerObject: {
              company: 'companyId2',
              person: 'personId1',
            },
          }),
        },
        {
          record: {
            objectNameSingular: 'person',
            objectLabelSingular: 'Person',
            tsRankCD: 0.87,
            tsRank: 0.87,
            recordId: 'personId2',
            label: '',
            imageUrl: '',
          },
          expectedCursor: encodeCursorData({
            lastRanks: { tsRankCD: 0.87, tsRank: 0.87 },
            lastRecordIdsPerObject: {
              company: 'companyId2',
              person: 'personId2',
            },
          }),
        },
        {
          record: {
            objectNameSingular: 'opportunity',
            objectLabelSingular: 'Opportunity',
            tsRankCD: 0.87,
            tsRank: 0.87,
            recordId: 'opportunityId1',
            label: '',
            imageUrl: '',
          },
          expectedCursor: encodeCursorData({
            lastRanks: { tsRankCD: 0.87, tsRank: 0.87 },
            lastRecordIdsPerObject: {
              company: 'companyId2',
              person: 'personId2',
              opportunity: 'opportunityId1',
            },
          }),
        },
        {
          record: {
            objectNameSingular: 'note',
            objectLabelSingular: 'Note',
            tsRankCD: 0.2,
            tsRank: 0.2,
            recordId: 'noteId1',
            label: '',
            imageUrl: '',
          },
          expectedCursor: encodeCursorData({
            lastRanks: { tsRankCD: 0.2, tsRank: 0.2 },
            lastRecordIdsPerObject: {
              company: 'companyId2',
              person: 'personId2',
              opportunity: 'opportunityId1',
              note: 'noteId1',
            },
          }),
        },
        {
          record: {
            objectNameSingular: 'company',
            objectLabelSingular: 'Company',
            tsRankCD: 0.1,
            tsRank: 0.1,
            recordId: 'companyId3',
            label: '',
            imageUrl: '',
          },
          expectedCursor: encodeCursorData({
            lastRanks: { tsRankCD: 0.1, tsRank: 0.1 },
            lastRecordIdsPerObject: {
              company: 'companyId3',
              person: 'personId2',
              opportunity: 'opportunityId1',
              note: 'noteId1',
            },
          }),
        },
      ];

      const edges = service.computeEdges({
        sortedRecords: sortedSlicedRecords.map((r) => r.record),
      });

      expect(edges.map((e) => e.cursor)).toEqual(
        sortedSlicedRecords.map((r) => r.expectedCursor),
      );
    });

    it('should compute pageInfo properly with an input after cursor', () => {
      const sortedSlicedRecords = [
        {
          record: {
            objectNameSingular: 'person',
            objectLabelSingular: 'Person',
            tsRankCD: 0.87,
            tsRank: 0.87,
            recordId: 'personId2',
            label: '',
            imageUrl: '',
          },
          expectedCursor: encodeCursorData({
            lastRanks: { tsRankCD: 0.87, tsRank: 0.87 },
            lastRecordIdsPerObject: {
              company: 'companyId2',
              person: 'personId2',
            },
          }),
        },
        {
          record: {
            objectNameSingular: 'opportunity',
            objectLabelSingular: 'Opportunity',
            tsRankCD: 0.87,
            tsRank: 0.87,
            recordId: 'opportunityId1',
            label: '',
            imageUrl: '',
          },
          expectedCursor: encodeCursorData({
            lastRanks: { tsRankCD: 0.87, tsRank: 0.87 },
            lastRecordIdsPerObject: {
              company: 'companyId2',
              person: 'personId2',
              opportunity: 'opportunityId1',
            },
          }),
        },
        {
          record: {
            objectNameSingular: 'note',
            objectLabelSingular: 'Note',
            tsRankCD: 0.2,
            tsRank: 0.2,
            recordId: 'noteId1',
            label: '',
            imageUrl: '',
          },
          expectedCursor: encodeCursorData({
            lastRanks: { tsRankCD: 0.2, tsRank: 0.2 },
            lastRecordIdsPerObject: {
              company: 'companyId2',
              person: 'personId2',
              opportunity: 'opportunityId1',
              note: 'noteId1',
            },
          }),
        },
        {
          record: {
            objectNameSingular: 'company',
            objectLabelSingular: 'Company',
            tsRankCD: 0.1,
            tsRank: 0.1,
            recordId: 'companyId3',
            label: '',
            imageUrl: '',
          },
          expectedCursor: encodeCursorData({
            lastRanks: { tsRankCD: 0.1, tsRank: 0.1 },
            lastRecordIdsPerObject: {
              company: 'companyId3',
              person: 'personId2',
              opportunity: 'opportunityId1',
              note: 'noteId1',
            },
          }),
        },
      ];

      const afterCursor = encodeCursorData({
        lastRanks: { tsRankCD: 0.87, tsRank: 0.87 },
        lastRecordIdsPerObject: {
          company: 'companyId2',
          person: 'personId1',
        },
      });

      const edges = service.computeEdges({
        sortedRecords: sortedSlicedRecords.map((r) => r.record),
        after: afterCursor,
      });

      expect(edges.map((e) => e.cursor)).toEqual(
        sortedSlicedRecords.map((r) => r.expectedCursor),
      );
    });
  });
});
