import { QueryRunner } from 'typeorm';

import { ExpandPermaventSalesRepCodeFastInstanceCommand } from 'src/database/commands/upgrade-version-command/2-15/2-15-instance-command-fast-1782209253761-expand-permavent-sales-rep-code';

describe('ExpandPermaventSalesRepCodeFastInstanceCommand', () => {
  const query = jest.fn();
  const queryRunner = { query } as unknown as QueryRunner;
  const command = new ExpandPermaventSalesRepCodeFastInstanceCommand();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should widen the column and replace the code constraint', async () => {
    await command.up(queryRunner);

    expect(query.mock.calls).toEqual([
      [
        'ALTER TABLE "core"."permaventSalesRepAssignment" DROP CONSTRAINT "CHK_PERMAVENT_SALES_REP_ASSIGNMENT_CODE"',
      ],
      [
        'ALTER TABLE "core"."permaventSalesRepAssignment" ALTER COLUMN "erpSalesRepCode" TYPE character varying(32)',
      ],
      [
        'ALTER TABLE "core"."permaventSalesRepAssignment" ADD CONSTRAINT "CHK_PERMAVENT_SALES_REP_ASSIGNMENT_CODE" CHECK ("erpSalesRepCode" ~ \'^[A-Z]{2,32}$\')',
      ],
    ]);
  });

  it('should restore the original limit when no longer assignments exist', async () => {
    query.mockResolvedValueOnce([{ count: 0 }]);

    await command.down(queryRunner);

    expect(query.mock.calls).toEqual([
      [
        'SELECT COUNT(*)::int AS "count" FROM "core"."permaventSalesRepAssignment" WHERE LENGTH("erpSalesRepCode") > 3',
      ],
      [
        'ALTER TABLE "core"."permaventSalesRepAssignment" DROP CONSTRAINT "CHK_PERMAVENT_SALES_REP_ASSIGNMENT_CODE"',
      ],
      [
        'ALTER TABLE "core"."permaventSalesRepAssignment" ALTER COLUMN "erpSalesRepCode" TYPE character varying(3)',
      ],
      [
        'ALTER TABLE "core"."permaventSalesRepAssignment" ADD CONSTRAINT "CHK_PERMAVENT_SALES_REP_ASSIGNMENT_CODE" CHECK ("erpSalesRepCode" ~ \'^[A-Z]{2,3}$\')',
      ],
    ]);
  });

  it('should refuse to narrow the column while longer assignments exist', async () => {
    query.mockResolvedValueOnce([{ count: 1 }]);

    await expect(command.down(queryRunner)).rejects.toThrow(
      'Cannot restore the three-letter Sales Rep code limit while longer assignments exist.',
    );
    expect(query).toHaveBeenCalledTimes(1);
  });
});
