import { buildMutationQueryBuilder } from 'src/engine/api/common/common-query-runners/utils/build-mutation-query-builder.util';

describe('buildMutationQueryBuilder', () => {
  const filter = {
    erpsalesrepcode: { is: 'NULL' },
  };

  it('should use direct column references for a mutation without joins', () => {
    const filteredQueryBuilder = {
      expressionMap: { joinAttributes: [] },
    };
    const directMutationQueryBuilder = {};
    const createQueryBuilder = jest
      .fn()
      .mockReturnValueOnce(filteredQueryBuilder)
      .mockReturnValueOnce(directMutationQueryBuilder);
    const applyFilterToBuilder = jest.fn();

    const result = buildMutationQueryBuilder({
      repository: { createQueryBuilder } as never,
      alias: 'branch',
      filter,
      commonQueryParser: { applyFilterToBuilder } as never,
    });

    expect(result).toBe(directMutationQueryBuilder);
    expect(applyFilterToBuilder).toHaveBeenNthCalledWith(
      1,
      filteredQueryBuilder,
      'branch',
      filter,
    );
    expect(applyFilterToBuilder).toHaveBeenNthCalledWith(
      2,
      directMutationQueryBuilder,
      'branch',
      filter,
      true,
    );
  });

  it('should keep the joined filter in a subquery with an unqualified outer id', () => {
    const filteredQueryBuilder = {
      expressionMap: {
        joinAttributes: [{}],
        parameters: { accountOwnerId: 'owner-id' },
      },
      select: jest.fn().mockReturnThis(),
      withDeleted: jest.fn().mockReturnThis(),
      getQuery: jest.fn().mockReturnValue('SELECT "branch"."id"'),
    };
    const outerQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
    };
    const createQueryBuilder = jest
      .fn()
      .mockReturnValueOnce(filteredQueryBuilder)
      .mockReturnValueOnce(outerQueryBuilder);

    buildMutationQueryBuilder({
      repository: { createQueryBuilder } as never,
      alias: 'branch',
      filter,
      commonQueryParser: { applyFilterToBuilder: jest.fn() } as never,
    });

    expect(outerQueryBuilder.where).toHaveBeenCalledWith(
      '"id" IN (SELECT "branch"."id")',
    );
    expect(outerQueryBuilder.setParameters).toHaveBeenCalledWith({
      accountOwnerId: 'owner-id',
    });
  });
});
