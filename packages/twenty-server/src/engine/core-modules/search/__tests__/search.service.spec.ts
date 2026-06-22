import { Test, type TestingModule } from '@nestjs/testing';

import { encodeCursorData } from 'src/engine/api/graphql/graphql-query-runner/utils/cursors.util';
import { type ObjectRecordFilter } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';
import {
  mockFlatFieldMetadataMaps,
  mockFlatObjectMetadatas,
} from 'src/engine/core-modules/__mocks__/mockFlatObjectMetadatas';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { FileUrlService } from 'src/engine/core-modules/file/file-url/file-url.service';
import { PermaventSecurityService } from 'src/engine/core-modules/permavent-security/permavent-security.service';
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
