import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { PermaventSalesScopeContextFactory } from 'src/engine/core-modules/permavent-sales-scope/context/permavent-sales-scope-context.factory';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { WorkspaceDataSourceService } from 'src/engine/twenty-orm/datasource/workspace-data-source.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-orm.manager';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { type PermaventWeeklySalesReportSource } from 'src/modules/permavent-weekly-sales-report/types/permavent-weekly-sales-report-source.type';
import { getPermaventLondonWeekWindow } from 'src/modules/permavent-weekly-sales-report/utils/get-permavent-london-week-window.util';

const MAX_WEEKLY_REPORT_ACTIVITIES = 1_000;

type SourceQueryRow = {
  actorMessageCount: number | string;
  entityCount: number | string;
  internalMessageCount: number | string;
  internalMessages: PermaventWeeklySalesReportSource['internalMessages'];
  messages: PermaventWeeklySalesReportSource['messages'];
  multiEntityMessageCount: number | string;
  multiEntityNoteCount: number | string;
  noteCount: number | string;
  notes: PermaventWeeklySalesReportSource['notes'];
  qualifiedMessageCount: number | string;
  unlinkedMessageCount: number | string;
  unlinkedMessages: PermaventWeeklySalesReportSource['unlinkedMessages'];
  unlinkedNoteCount: number | string;
  unlinkedNotes: PermaventWeeklySalesReportSource['unlinkedNotes'];
};

@Injectable()
export class PermaventWeeklySalesReportSourceService {
  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly salesScopeContextFactory: PermaventSalesScopeContextFactory,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly workspaceDataSourceService: WorkspaceDataSourceService,
  ) {}

  public async getSource({
    authContext,
    includeBody,
    generatedAt = new Date(),
  }: {
    authContext: WorkspaceAuthContext;
    includeBody: boolean;
    generatedAt?: Date;
  }): Promise<PermaventWeeklySalesReportSource> {
    if (
      !this.twentyConfigService.get('PERMAVENT_WEEKLY_SALES_REPORT_ENABLED')
    ) {
      throw new NotFoundException('Weekly Sales Report is not enabled.');
    }

    const salesScopeContext =
      await this.salesScopeContextFactory.create(authContext);

    if (
      !salesScopeContext.isSupportedUserContext ||
      !salesScopeContext.isRestrictedSalesRep ||
      salesScopeContext.workspaceId === null ||
      salesScopeContext.workspaceMemberId === null
    ) {
      throw new ForbiddenException(
        'Weekly Sales Report is available to Sales Reps only.',
      );
    }

    const window = getPermaventLondonWeekWindow(generatedAt);
    const schemaName = getWorkspaceSchemaName(salesScopeContext.workspaceId);
    const rows = await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        return await this.workspaceDataSourceService
          .getDataSource({ useReplica: true })
          .transaction(
            async ({ executeRawQuery }) =>
              (await executeRawQuery(this.buildSourceQuery(schemaName), [
                salesScopeContext.workspaceMemberId,
                window.start,
                window.generatedAt,
                includeBody,
                MAX_WEEKLY_REPORT_ACTIVITIES + 1,
              ])) as SourceQueryRow[],
          );
      },
      authContext,
    );
    const row = rows[0];

    if (!row) {
      throw new Error('Weekly Sales Report source query returned no result.');
    }

    const activityCount =
      Number(row.actorMessageCount) +
      Number(row.noteCount) +
      Number(row.unlinkedNoteCount);

    if (activityCount > MAX_WEEKLY_REPORT_ACTIVITIES) {
      throw new PayloadTooLargeException(
        'Weekly Sales Report contains too many activities to process safely.',
      );
    }

    return {
      actorWorkspaceMemberId: salesScopeContext.workspaceMemberId,
      period: {
        generatedAt: window.generatedAt.toISOString(),
        start: window.start.toISOString(),
        timeZone: window.timeZone,
      },
      scope: {
        activeTerritoryCount: salesScopeContext.allowedSalesRepCodes.length,
        entityCount: Number(row.entityCount),
      },
      stats: {
        internalMessageCount: Number(row.internalMessageCount),
        messageCount: Number(row.qualifiedMessageCount),
        multiEntityMessageCount: Number(row.multiEntityMessageCount),
        multiEntityNoteCount: Number(row.multiEntityNoteCount),
        noteCount: Number(row.noteCount),
        unlinkedMessageCount: Number(row.unlinkedMessageCount),
        unlinkedNoteCount: Number(row.unlinkedNoteCount),
      },
      messages: row.messages ?? [],
      internalMessages: row.internalMessages ?? [],
      notes: row.notes ?? [],
      unlinkedMessages: row.unlinkedMessages ?? [],
      unlinkedNotes: row.unlinkedNotes ?? [],
    };
  }

  private buildSourceQuery(schemaName: string): string {
    return `
      WITH week_message AS (
        SELECT message.*
        FROM "${schemaName}"."message" AS message
        WHERE message."deletedAt" IS NULL
          AND message."isDraft" IS NOT TRUE
          AND message."receivedAt" >= $2
          AND message."receivedAt" <= $3
      ),
      actor_message AS (
        SELECT DISTINCT week_message.id
        FROM week_message
        JOIN "${schemaName}"."messageParticipant" AS participant
          ON participant."messageId" = week_message.id
         AND participant."deletedAt" IS NULL
        WHERE participant."workspaceMemberId" = $1
          AND participant.role IN ('FROM', 'TO', 'CC', 'BCC')
      ),
      message_branch_candidate AS (
        SELECT DISTINCT
          actor_message.id AS "messageId",
          branch.id AS "entityId",
          branch.name AS "entityName",
          branch."companyId" AS "parentCompanyId"
        FROM actor_message
        JOIN "${schemaName}"."messageParticipant" AS participant
          ON participant."messageId" = actor_message.id
         AND participant."deletedAt" IS NULL
        JOIN "${schemaName}"."person" AS person
          ON person.id = participant."personId"
         AND person."deletedAt" IS NULL
        JOIN "${schemaName}"."_branch" AS branch
          ON branch.id = person."branchId"
         AND branch."deletedAt" IS NULL
      ),
      message_company_candidate AS (
        SELECT DISTINCT
          actor_message.id AS "messageId",
          company.id AS "entityId",
          company.name AS "entityName"
        FROM actor_message
        JOIN "${schemaName}"."messageParticipant" AS participant
          ON participant."messageId" = actor_message.id
         AND participant."deletedAt" IS NULL
        JOIN "${schemaName}"."person" AS person
          ON person.id = participant."personId"
         AND person."deletedAt" IS NULL
        JOIN "${schemaName}"."company" AS company
          ON company.id = person."companyId"
         AND company."deletedAt" IS NULL
      ),
      message_entity AS (
        SELECT DISTINCT
          "messageId",
          'BRANCH'::text AS "entityType",
          "entityId",
          "entityName"
        FROM message_branch_candidate
        UNION
        SELECT DISTINCT
          company."messageId",
          'COMPANY'::text AS "entityType",
          company."entityId",
          company."entityName"
        FROM message_company_candidate AS company
        WHERE NOT EXISTS (
          SELECT 1
          FROM message_branch_candidate AS branch
          WHERE branch."messageId" = company."messageId"
            AND branch."parentCompanyId" = company."entityId"
        )
      ),
      qualified_message AS (
        SELECT DISTINCT "messageId" AS id
        FROM message_entity
      ),
      internal_message AS (
        SELECT actor_message.id
        FROM actor_message
        WHERE NOT EXISTS (
          SELECT 1
          FROM "${schemaName}"."messageParticipant" AS participant
          JOIN "${schemaName}"."person" AS person
            ON person.id = participant."personId"
           AND person."deletedAt" IS NULL
          WHERE participant."messageId" = actor_message.id
            AND participant."deletedAt" IS NULL
        )
      ),
      message_payload AS (
        SELECT
          week_message.id,
          jsonb_build_object(
            'id', week_message.id,
            'messageThreadId', week_message."messageThreadId",
            'subject', coalesce(week_message.subject, ''),
            'body', CASE WHEN $4::boolean THEN week_message.text ELSE NULL END,
            'receivedAt', week_message."receivedAt",
            'entities', coalesce((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'entityType', entity."entityType",
                  'id', entity."entityId",
                  'name', entity."entityName"
                )
                ORDER BY entity."entityType", entity."entityName", entity."entityId"
              )
              FROM message_entity AS entity
              WHERE entity."messageId" = week_message.id
            ), '[]'::jsonb),
            'participants', coalesce((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'role', participant.role,
                  'handle', participant.handle,
                  'displayName', participant."displayName"
                )
                ORDER BY participant.role, participant.handle, participant.id
              )
              FROM "${schemaName}"."messageParticipant" AS participant
              WHERE participant."messageId" = week_message.id
                AND participant."deletedAt" IS NULL
            ), '[]'::jsonb)
          ) AS payload
        FROM week_message
        JOIN qualified_message ON qualified_message.id = week_message.id
        ORDER BY week_message."receivedAt", week_message.id
        LIMIT $5
      ),
      internal_message_payload AS (
        SELECT
          week_message.id,
          jsonb_build_object(
            'id', week_message.id,
            'messageThreadId', week_message."messageThreadId",
            'subject', coalesce(week_message.subject, ''),
            'body', CASE WHEN $4::boolean THEN week_message.text ELSE NULL END,
            'receivedAt', week_message."receivedAt",
            'entities', '[]'::jsonb,
            'participants', coalesce((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'role', participant.role,
                  'handle', participant.handle,
                  'displayName', participant."displayName"
                )
                ORDER BY participant.role, participant.handle, participant.id
              )
              FROM "${schemaName}"."messageParticipant" AS participant
              WHERE participant."messageId" = week_message.id
                AND participant."deletedAt" IS NULL
            ), '[]'::jsonb)
          ) AS payload
        FROM week_message
        JOIN internal_message ON internal_message.id = week_message.id
        ORDER BY week_message."receivedAt", week_message.id
        LIMIT $5
      ),
      unlinked_message_payload AS (
        SELECT
          week_message.id,
          jsonb_build_object(
            'id', week_message.id,
            'messageThreadId', week_message."messageThreadId",
            'subject', coalesce(week_message.subject, ''),
            'body', CASE WHEN $4::boolean THEN week_message.text ELSE NULL END,
            'receivedAt', week_message."receivedAt",
            'participants', coalesce((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'role', participant.role,
                  'handle', participant.handle,
                  'displayName', participant."displayName"
                )
                ORDER BY participant.role, participant.handle, participant.id
              )
              FROM "${schemaName}"."messageParticipant" AS participant
              WHERE participant."messageId" = week_message.id
                AND participant."deletedAt" IS NULL
            ), '[]'::jsonb),
            'reason', 'PERSON_WITHOUT_ENTITY'
          ) AS payload
        FROM actor_message
        JOIN week_message ON week_message.id = actor_message.id
        WHERE NOT EXISTS (
          SELECT 1 FROM qualified_message WHERE qualified_message.id = actor_message.id
        )
          AND NOT EXISTS (
            SELECT 1 FROM internal_message WHERE internal_message.id = actor_message.id
          )
        ORDER BY week_message."receivedAt", week_message.id
        LIMIT $5
      ),
      week_note AS (
        SELECT note.*
        FROM "${schemaName}"."note" AS note
        WHERE note."deletedAt" IS NULL
          AND note."createdByWorkspaceMemberId" = $1
          AND note."createdAt" >= $2
          AND note."createdAt" <= $3
      ),
      note_branch_candidate AS (
        SELECT DISTINCT
          target."noteId",
          branch.id AS "entityId",
          branch.name AS "entityName",
          branch."companyId" AS "parentCompanyId"
        FROM "${schemaName}"."noteTarget" AS target
        JOIN week_note ON week_note.id = target."noteId"
        JOIN "${schemaName}"."_branch" AS branch
          ON branch.id = target."targetBranchId"
         AND branch."deletedAt" IS NULL
        WHERE target."deletedAt" IS NULL
        UNION
        SELECT DISTINCT
          target."noteId",
          branch.id AS "entityId",
          branch.name AS "entityName",
          branch."companyId" AS "parentCompanyId"
        FROM "${schemaName}"."noteTarget" AS target
        JOIN week_note ON week_note.id = target."noteId"
        JOIN "${schemaName}"."person" AS person
          ON person.id = target."targetPersonId"
         AND person."deletedAt" IS NULL
        JOIN "${schemaName}"."_branch" AS branch
          ON branch.id = person."branchId"
         AND branch."deletedAt" IS NULL
        WHERE target."deletedAt" IS NULL
        UNION
        SELECT DISTINCT
          target."noteId",
          branch.id AS "entityId",
          branch.name AS "entityName",
          branch."companyId" AS "parentCompanyId"
        FROM "${schemaName}"."noteTarget" AS target
        JOIN week_note ON week_note.id = target."noteId"
        JOIN "${schemaName}"."opportunity" AS opportunity
          ON opportunity.id = target."targetOpportunityId"
         AND opportunity."deletedAt" IS NULL
        JOIN "${schemaName}"."_branch" AS branch
          ON branch.id = opportunity."branchId"
         AND branch."deletedAt" IS NULL
        WHERE target."deletedAt" IS NULL
      ),
      note_company_candidate AS (
        SELECT DISTINCT target."noteId", company.id AS "entityId", company.name AS "entityName"
        FROM "${schemaName}"."noteTarget" AS target
        JOIN week_note ON week_note.id = target."noteId"
        JOIN "${schemaName}"."company" AS company
          ON company.id = target."targetCompanyId"
         AND company."deletedAt" IS NULL
        WHERE target."deletedAt" IS NULL
        UNION
        SELECT DISTINCT target."noteId", company.id AS "entityId", company.name AS "entityName"
        FROM "${schemaName}"."noteTarget" AS target
        JOIN week_note ON week_note.id = target."noteId"
        JOIN "${schemaName}"."person" AS person
          ON person.id = target."targetPersonId"
         AND person."deletedAt" IS NULL
        JOIN "${schemaName}"."company" AS company
          ON company.id = person."companyId"
         AND company."deletedAt" IS NULL
        WHERE target."deletedAt" IS NULL
        UNION
        SELECT DISTINCT target."noteId", company.id AS "entityId", company.name AS "entityName"
        FROM "${schemaName}"."noteTarget" AS target
        JOIN week_note ON week_note.id = target."noteId"
        JOIN "${schemaName}"."opportunity" AS opportunity
          ON opportunity.id = target."targetOpportunityId"
         AND opportunity."deletedAt" IS NULL
        JOIN "${schemaName}"."company" AS company
          ON company.id = opportunity."companyId"
         AND company."deletedAt" IS NULL
        WHERE target."deletedAt" IS NULL
      ),
      note_entity AS (
        SELECT DISTINCT
          "noteId",
          'BRANCH'::text AS "entityType",
          "entityId",
          "entityName"
        FROM note_branch_candidate
        UNION
        SELECT DISTINCT
          company."noteId",
          'COMPANY'::text AS "entityType",
          company."entityId",
          company."entityName"
        FROM note_company_candidate AS company
        WHERE NOT EXISTS (
          SELECT 1
          FROM note_branch_candidate AS branch
          WHERE branch."noteId" = company."noteId"
            AND branch."parentCompanyId" = company."entityId"
        )
      ),
      qualified_note AS (
        SELECT DISTINCT "noteId" AS id
        FROM note_entity
      ),
      note_payload AS (
        SELECT
          week_note.id,
          jsonb_build_object(
            'id', week_note.id,
            'title', coalesce(week_note.title, ''),
            'body', CASE WHEN $4::boolean THEN week_note."bodyV2Markdown" ELSE NULL END,
            'createdAt', week_note."createdAt",
            'entities', coalesce((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'entityType', entity."entityType",
                  'id', entity."entityId",
                  'name', entity."entityName"
                )
                ORDER BY entity."entityType", entity."entityName", entity."entityId"
              )
              FROM note_entity AS entity
              WHERE entity."noteId" = week_note.id
            ), '[]'::jsonb)
          ) AS payload
        FROM week_note
        JOIN qualified_note ON qualified_note.id = week_note.id
        ORDER BY week_note."createdAt", week_note.id
        LIMIT $5
      ),
      unlinked_note_payload AS (
        SELECT
          week_note.id,
          jsonb_build_object(
            'id', week_note.id,
            'title', coalesce(week_note.title, ''),
            'body', CASE WHEN $4::boolean THEN week_note."bodyV2Markdown" ELSE NULL END,
            'createdAt', week_note."createdAt",
            'reason', 'NO_ENTITY'
          ) AS payload
        FROM week_note
        WHERE NOT EXISTS (
          SELECT 1 FROM qualified_note WHERE qualified_note.id = week_note.id
        )
        ORDER BY week_note."createdAt", week_note.id
        LIMIT $5
      )
      SELECT
        (SELECT count(*) FROM actor_message) AS "actorMessageCount",
        (SELECT count(*) FROM message_entity) + (SELECT count(*) FROM note_entity) AS "entityCount",
        (SELECT count(*) FROM qualified_message) AS "qualifiedMessageCount",
        (SELECT count(*) FROM internal_message) AS "internalMessageCount",
        (
          SELECT count(*)
          FROM (
            SELECT "messageId"
            FROM message_entity
            GROUP BY "messageId"
            HAVING count(*) > 1
          ) AS multi_entity_message
        ) AS "multiEntityMessageCount",
        (SELECT count(*) FROM qualified_note) AS "noteCount",
        (
          SELECT count(*)
          FROM (
            SELECT "noteId"
            FROM note_entity
            GROUP BY "noteId"
            HAVING count(*) > 1
          ) AS multi_entity_note
        ) AS "multiEntityNoteCount",
        (SELECT count(*) FROM actor_message WHERE NOT EXISTS (
          SELECT 1 FROM qualified_message WHERE qualified_message.id = actor_message.id
        ) AND NOT EXISTS (
          SELECT 1 FROM internal_message WHERE internal_message.id = actor_message.id
        )) AS "unlinkedMessageCount",
        (SELECT count(*) FROM week_note WHERE NOT EXISTS (
          SELECT 1 FROM qualified_note WHERE qualified_note.id = week_note.id
        )) AS "unlinkedNoteCount",
        coalesce((SELECT jsonb_agg(payload ORDER BY id) FROM message_payload), '[]'::jsonb) AS messages,
        coalesce((SELECT jsonb_agg(payload ORDER BY id) FROM internal_message_payload), '[]'::jsonb) AS "internalMessages",
        coalesce((SELECT jsonb_agg(payload ORDER BY id) FROM unlinked_message_payload), '[]'::jsonb) AS "unlinkedMessages",
        coalesce((SELECT jsonb_agg(payload ORDER BY id) FROM note_payload), '[]'::jsonb) AS notes,
        coalesce((SELECT jsonb_agg(payload ORDER BY id) FROM unlinked_note_payload), '[]'::jsonb) AS "unlinkedNotes"
    `;
  }
}
