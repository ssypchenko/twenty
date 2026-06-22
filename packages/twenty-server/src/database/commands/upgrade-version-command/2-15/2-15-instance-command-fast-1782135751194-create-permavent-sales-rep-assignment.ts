import { QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.15.0', 1782135751194)
export class CreatePermaventSalesRepAssignmentFastInstanceCommand implements FastInstanceCommand {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "core"."permaventSalesRepAssignment" ("workspaceId" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userWorkspaceId" uuid, "workspaceMemberId" uuid, "userEmail" character varying(320) NOT NULL, "erpSalesRepCode" character varying(3) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "validFrom" TIMESTAMP WITH TIME ZONE, "validTo" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_PERMAVENT_SALES_REP_ASSIGNMENT_VALIDITY" CHECK ("validFrom" IS NULL OR "validTo" IS NULL OR "validTo" > "validFrom"), CONSTRAINT "CHK_PERMAVENT_SALES_REP_ASSIGNMENT_EMAIL" CHECK ("userEmail" = LOWER(BTRIM("userEmail")) AND LENGTH("userEmail") > 0), CONSTRAINT "CHK_PERMAVENT_SALES_REP_ASSIGNMENT_CODE" CHECK ("erpSalesRepCode" ~ \'^[A-Z]{2,3}$\'), CONSTRAINT "PK_0267f4f99de21481233b81c8423" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_PERMAVENT_SALES_REP_ASSIGNMENT_REVERSE_LOOKUP" ON "core"."permaventSalesRepAssignment" ("workspaceId", "erpSalesRepCode", "isActive")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_PERMAVENT_SALES_REP_ASSIGNMENT_LOOKUP" ON "core"."permaventSalesRepAssignment" ("workspaceId", "userEmail", "isActive")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_PERMAVENT_SALES_REP_ASSIGNMENT_UNIQUE" ON "core"."permaventSalesRepAssignment" ("workspaceId", "userEmail", "erpSalesRepCode")',
    );
    await queryRunner.query(
      'ALTER TABLE "core"."permaventSalesRepAssignment" ADD CONSTRAINT "FK_e760cdbfe597cb6816379fa8c49" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "core"."permaventSalesRepAssignment" ADD CONSTRAINT "FK_84837b1114fcea9c2aba63f8023" FOREIGN KEY ("userWorkspaceId") REFERENCES "core"."userWorkspace"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "core"."permaventSalesRepAssignment" DROP CONSTRAINT "FK_84837b1114fcea9c2aba63f8023"',
    );
    await queryRunner.query(
      'ALTER TABLE "core"."permaventSalesRepAssignment" DROP CONSTRAINT "FK_e760cdbfe597cb6816379fa8c49"',
    );
    await queryRunner.query(
      'DROP INDEX "core"."IDX_PERMAVENT_SALES_REP_ASSIGNMENT_UNIQUE"',
    );
    await queryRunner.query(
      'DROP INDEX "core"."IDX_PERMAVENT_SALES_REP_ASSIGNMENT_LOOKUP"',
    );
    await queryRunner.query(
      'DROP INDEX "core"."IDX_PERMAVENT_SALES_REP_ASSIGNMENT_REVERSE_LOOKUP"',
    );
    await queryRunner.query(
      'DROP TABLE "core"."permaventSalesRepAssignment"',
    );
  }
}
