import { FieldMetadataType } from 'twenty-shared/types';

import { computeWhereConditionParts } from 'src/engine/api/graphql/graphql-query-runner/utils/compute-where-condition-parts';

describe('computeWhereConditionParts', () => {
  it('should use an unqualified field reference for a direct mutation filter', () => {
    const { sql, params } = computeWhereConditionParts({
      operator: 'is',
      objectNameSingular: 'branch',
      key: 'erpsalesrepcode',
      value: 'NULL',
      fieldMetadataType: FieldMetadataType.TEXT,
      useDirectTableReference: true,
    });

    expect(sql).toMatch(
      /^"erpsalesrepcode" IS NULL OR "erpsalesrepcode" = :erpsalesrepcode[0-9a-f]+$/,
    );
    expect(Object.values(params)).toEqual(['']);
  });
});
