import { FieldMetadataType, RelationType } from 'twenty-shared/types';

import { FilterArgProcessorService } from 'src/engine/api/common/common-args-processors/filter-arg-processor/filter-arg-processor.service';
import { type PermaventSecurityContext } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.type';
import { PermaventAccessFilterBuilder } from 'src/engine/core-modules/permavent-security/filters/permavent-access-filter.builder';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';

describe('PermaventAccessFilterBuilder', () => {
  const builder = new PermaventAccessFilterBuilder();
  const filterArgProcessor = new FilterArgProcessorService();
  const context = {
    userEmail: 'sales.rep@example.test',
    allowedSalesRepCodes: ['DM', 'RT'],
  } as PermaventSecurityContext;
  const flatFields = [
    {
      id: 'id-field-id',
      universalIdentifier: 'id-field-universal-identifier',
      objectMetadataId: 'object-id',
      name: 'id',
      type: FieldMetadataType.UUID,
      isNullable: false,
    },
    {
      id: 'sales-rep-email-field-id',
      universalIdentifier: 'sales-rep-email-field-universal-identifier',
      objectMetadataId: 'object-id',
      name: 'salesrepemail',
      type: FieldMetadataType.EMAILS,
      isNullable: true,
    },
    {
      id: 'erp-sales-rep-code-field-id',
      universalIdentifier: 'erp-sales-rep-code-field-universal-identifier',
      objectMetadataId: 'object-id',
      name: 'erpsalesrepcode',
      type: FieldMetadataType.TEXT,
      isNullable: true,
    },
  ] as FlatFieldMetadata[];
  const flatFieldMetadataMaps = {
    byUniversalIdentifier: Object.fromEntries(
      flatFields.map((field) => [field.universalIdentifier, field]),
    ),
    universalIdentifierById: Object.fromEntries(
      flatFields.map((field) => [field.id, field.universalIdentifier]),
    ),
    universalIdentifiersByApplicationId: {},
  } as FlatEntityMaps<FlatFieldMetadata>;
  const flatObjectMetadata = {
    id: 'object-id',
    universalIdentifier: 'object-universal-identifier',
    nameSingular: 'company',
    fieldIds: flatFields.map((field) => field.id),
  } as FlatObjectMetadata;

  it('should build direct email or ERP code ownership conditions', () => {
    const filter = builder.buildCompanyOrBranchFilter(context);

    expect(filter).toEqual({
      or: [
        {
          salesrepemail: {
            primaryEmail: { ilike: 'sales.rep@example.test' },
          },
        },
        {
          erpsalesrepcode: { in: ['DM', 'RT'] },
        },
      ],
    });
    expect(
      filterArgProcessor.process({
        filter,
        flatObjectMetadata,
        flatFieldMetadataMaps,
      }),
    ).toEqual(filter);
  });

  it('should build a contradictory filter without active assignments', () => {
    const filter = builder.buildCompanyOrBranchFilter({
      ...context,
      allowedSalesRepCodes: [],
    });

    expect(filter).toEqual({
      and: [{ id: { is: 'NULL' } }, { id: { is: 'NOT_NULL' } }],
    });
    expect(
      filterArgProcessor.process({
        filter,
        flatObjectMetadata,
        flatFieldMetadataMaps,
      }),
    ).toEqual(filter);
  });

  it('should build a valid Company-or-Branch relation ownership filter', () => {
    const sourceObjectId = 'source-object-id';
    const companyObjectId = 'company-object-id';
    const branchObjectId = 'branch-object-id';
    const sourceUniversalIdentifier = 'source-object-universal-identifier';
    const companyUniversalIdentifier = 'company-object-universal-identifier';
    const branchUniversalIdentifier = 'branch-object-universal-identifier';
    const relationFields = [
      {
        id: 'company-relation-field-id',
        universalIdentifier: 'company-relation-field-universal-identifier',
        objectMetadataId: sourceObjectId,
        name: 'company',
        type: FieldMetadataType.RELATION,
        isNullable: true,
        relationTargetObjectMetadataId: companyObjectId,
        settings: {
          relationType: RelationType.MANY_TO_ONE,
          joinColumnName: 'companyId',
        },
      },
      {
        id: 'branch-relation-field-id',
        universalIdentifier: 'branch-relation-field-universal-identifier',
        objectMetadataId: sourceObjectId,
        name: 'branch',
        type: FieldMetadataType.RELATION,
        isNullable: true,
        relationTargetObjectMetadataId: branchObjectId,
        settings: {
          relationType: RelationType.MANY_TO_ONE,
          joinColumnName: 'branchId',
        },
      },
    ] as FlatFieldMetadata[];
    const ownershipFields = [companyObjectId, branchObjectId].flatMap(
      (objectMetadataId) => [
        {
          id: `${objectMetadataId}-sales-rep-email-field-id`,
          universalIdentifier: `${objectMetadataId}-sales-rep-email-field-universal-identifier`,
          objectMetadataId,
          name: 'salesrepemail',
          type: FieldMetadataType.EMAILS,
          isNullable: true,
        },
        {
          id: `${objectMetadataId}-erp-sales-rep-code-field-id`,
          universalIdentifier: `${objectMetadataId}-erp-sales-rep-code-field-universal-identifier`,
          objectMetadataId,
          name: 'erpsalesrepcode',
          type: FieldMetadataType.TEXT,
          isNullable: true,
        },
      ],
    ) as FlatFieldMetadata[];
    const relationFlatFields = [...relationFields, ...ownershipFields];
    const relationFlatFieldMetadataMaps = {
      byUniversalIdentifier: Object.fromEntries(
        relationFlatFields.map((field) => [field.universalIdentifier, field]),
      ),
      universalIdentifierById: Object.fromEntries(
        relationFlatFields.map((field) => [
          field.id,
          field.universalIdentifier,
        ]),
      ),
      universalIdentifiersByApplicationId: {},
    } as FlatEntityMaps<FlatFieldMetadata>;
    const sourceObjectMetadata = {
      id: sourceObjectId,
      universalIdentifier: sourceUniversalIdentifier,
      nameSingular: 'opportunity',
      fieldIds: relationFields.map((field) => field.id),
    } as FlatObjectMetadata;
    const companyObjectMetadata = {
      id: companyObjectId,
      universalIdentifier: companyUniversalIdentifier,
      nameSingular: 'company',
      fieldIds: ownershipFields
        .filter((field) => field.objectMetadataId === companyObjectId)
        .map((field) => field.id),
    } as FlatObjectMetadata;
    const branchObjectMetadata = {
      id: branchObjectId,
      universalIdentifier: branchUniversalIdentifier,
      nameSingular: 'branch',
      fieldIds: ownershipFields
        .filter((field) => field.objectMetadataId === branchObjectId)
        .map((field) => field.id),
    } as FlatObjectMetadata;
    const relationFlatObjectMetadataMaps = {
      byUniversalIdentifier: {
        [sourceUniversalIdentifier]: sourceObjectMetadata,
        [companyUniversalIdentifier]: companyObjectMetadata,
        [branchUniversalIdentifier]: branchObjectMetadata,
      },
      universalIdentifierById: {
        [sourceObjectId]: sourceUniversalIdentifier,
        [companyObjectId]: companyUniversalIdentifier,
        [branchObjectId]: branchUniversalIdentifier,
      },
      universalIdentifiersByApplicationId: {},
    } as FlatEntityMaps<FlatObjectMetadata>;

    const filter = builder.buildRelatedCompanyOrBranchFilter(context);

    expect(filter).toEqual({
      or: [
        {
          company: {
            or: [
              {
                salesrepemail: {
                  primaryEmail: { ilike: 'sales.rep@example.test' },
                },
              },
              { erpsalesrepcode: { in: ['DM', 'RT'] } },
            ],
          },
        },
        {
          branch: {
            or: [
              {
                salesrepemail: {
                  primaryEmail: { ilike: 'sales.rep@example.test' },
                },
              },
              { erpsalesrepcode: { in: ['DM', 'RT'] } },
            ],
          },
        },
      ],
    });
    expect(
      filterArgProcessor.process({
        filter,
        flatObjectMetadata: sourceObjectMetadata,
        flatObjectMetadataMaps: relationFlatObjectMetadataMaps,
        flatFieldMetadataMaps: relationFlatFieldMetadataMaps,
      }),
    ).toEqual(filter);
  });

  it('should fail closed for related reads without active assignments', () => {
    expect(
      builder.buildRelatedCompanyOrBranchFilter({
        ...context,
        allowedSalesRepCodes: [],
      }),
    ).toEqual({
      and: [{ id: { is: 'NULL' } }, { id: { is: 'NOT_NULL' } }],
    });
  });
});
