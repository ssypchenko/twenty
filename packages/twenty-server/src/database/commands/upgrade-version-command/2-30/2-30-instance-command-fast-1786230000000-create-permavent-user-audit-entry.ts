import { type QueryRunner } from 'typeorm';
import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.30.0', 1786230000000)
export class CreatePermaventUserAuditEntryFastInstanceCommand implements FastInstanceCommand {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "core"."permaventUserAuditEntry" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "userWorkspaceId" uuid, "workspaceMemberId" uuid, "actorDisplayName" character varying, "action" character varying NOT NULL, "result" character varying NOT NULL, "objectMetadataId" uuid, "objectName" character varying, "recordId" uuid, "recordName" character varying, "changedFields" jsonb NOT NULL DEFAULT '[]', "newValues" jsonb NOT NULL DEFAULT '{}', "denialCategory" character varying, "sourceEventId" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_PERMAVENT_USER_AUDIT_ENTRY" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_PERMAVENT_USER_AUDIT_WORKSPACE_CREATED" ON "core"."permaventUserAuditEntry" ("workspaceId", "createdAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_PERMAVENT_USER_AUDIT_WORKSPACE_RECORD" ON "core"."permaventUserAuditEntry" ("workspaceId", "recordId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_PERMAVENT_USER_AUDIT_SOURCE_EVENT" ON "core"."permaventUserAuditEntry" ("sourceEventId") WHERE "sourceEventId" IS NOT NULL`);
  }
  async down(queryRunner: QueryRunner): Promise<void> { await queryRunner.query('DROP TABLE IF EXISTS "core"."permaventUserAuditEntry"'); }
}
