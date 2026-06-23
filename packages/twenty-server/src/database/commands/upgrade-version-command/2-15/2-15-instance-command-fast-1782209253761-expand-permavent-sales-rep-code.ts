import { QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.15.0', 1782209253761)
export class ExpandPermaventSalesRepCodeFastInstanceCommand implements FastInstanceCommand {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "core"."permaventSalesRepAssignment" DROP CONSTRAINT "CHK_PERMAVENT_SALES_REP_ASSIGNMENT_CODE"',
    );
    await queryRunner.query(
      'ALTER TABLE "core"."permaventSalesRepAssignment" ALTER COLUMN "erpSalesRepCode" TYPE character varying(32)',
    );
    await queryRunner.query(
      'ALTER TABLE "core"."permaventSalesRepAssignment" ADD CONSTRAINT "CHK_PERMAVENT_SALES_REP_ASSIGNMENT_CODE" CHECK ("erpSalesRepCode" ~ \'^[A-Z]{2,32}$\')',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::int AS "count" FROM "core"."permaventSalesRepAssignment" WHERE LENGTH("erpSalesRepCode") > 3',
    )) as Array<{ count: number }>;

    if (count > 0) {
      throw new Error(
        'Cannot restore the three-letter Sales Rep code limit while longer assignments exist.',
      );
    }

    await queryRunner.query(
      'ALTER TABLE "core"."permaventSalesRepAssignment" DROP CONSTRAINT "CHK_PERMAVENT_SALES_REP_ASSIGNMENT_CODE"',
    );
    await queryRunner.query(
      'ALTER TABLE "core"."permaventSalesRepAssignment" ALTER COLUMN "erpSalesRepCode" TYPE character varying(3)',
    );
    await queryRunner.query(
      'ALTER TABLE "core"."permaventSalesRepAssignment" ADD CONSTRAINT "CHK_PERMAVENT_SALES_REP_ASSIGNMENT_CODE" CHECK ("erpSalesRepCode" ~ \'^[A-Z]{2,3}$\')',
    );
  }
}
