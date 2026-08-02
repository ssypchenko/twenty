import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { PermaventSecurityContextFactory } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.factory';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { type PermaventWeeklySalesReportSource } from 'src/modules/permavent-weekly-sales-report/types/permavent-weekly-sales-report-source.type';
import { getPermaventLondonWeekWindow } from 'src/modules/permavent-weekly-sales-report/utils/get-permavent-london-week-window.util';

const MAX_WEEKLY_REPORT_ACTIVITIES = 1_000;

type SourceQueryRow = {
  companyCount: number | string;
  messages: PermaventWeeklySalesReportSource['messages'];
  multiCompanyMessageCount: number | string;
  multiCompanyNoteCount: number | string;
  noteCount: number | string;
  notes: PermaventWeeklySalesReportSource['notes'];
  peopleCount: number | string;
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
    private readonly securityContextFactory: PermaventSecurityContextFactory,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
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

    const securityContext =
      await this.securityContextFactory.create(authContext);

    if (
      !securityContext.isSupportedUserContext ||
      !securityContext.isRestrictedSalesRep ||
      securityContext.workspaceId === null ||
      securityContext.workspaceMemberId === null
    ) {
      throw new ForbiddenException(
        'Weekly Sales Report is available to Sales Reps only.',
      );
    }

    const window = getPermaventLondonWeekWindow(generatedAt);
    const schemaName = getWorkspaceSchemaName(securityContext.workspaceId);
    const rows = await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const dataSource =
          await this.globalWorkspaceOrmManager.getGlobalWorkspaceDataSourceReplica();

        return dataSource.query<SourceQueryRow[]>(
          this.buildSourceQuery(schemaName),
          [
            securityContext.workspaceMemberId,
            securityContext.allowedSalesRepCodes,
            window.start,
            window.generatedAt,
            includeBody,
            MAX_WEEKLY_REPORT_ACTIVITIES + 1,
          ],
          undefined,
          { shouldBypassPermissionChecks: true },
        );
      },
      authContext,
    );
    const row = rows[0];

    if (!row) {
      throw new Error('Weekly Sales Report source query returned no result.');
    }

    const qualifiedMessageCount = Number(row.qualifiedMessageCount);
    const noteCount = Number(row.noteCount);
    const unlinkedMessageCount = Number(row.unlinkedMessageCount);
    const unlinkedNoteCount = Number(row.unlinkedNoteCount);

    if (
      qualifiedMessageCount + noteCount > MAX_WEEKLY_REPORT_ACTIVITIES ||
      unlinkedMessageCount + unlinkedNoteCount > MAX_WEEKLY_REPORT_ACTIVITIES
    ) {
      throw new PayloadTooLargeException(
        'Weekly Sales Report contains too many activities to process safely.',
      );
    }

    return {
      actorWorkspaceMemberId: securityContext.workspaceMemberId,
      period: {
        generatedAt: window.generatedAt.toISOString(),
        start: window.start.toISOString(),
        timeZone: window.timeZone,
      },
      scope: {
        activeTerritoryCount: securityContext.allowedSalesRepCodes.length,
        companyCount: Number(row.companyCount),
        peopleCount: Number(row.peopleCount),
      },
      stats: {
        messageCount: qualifiedMessageCount,
        multiCompanyMessageCount: Number(row.multiCompanyMessageCount),
        multiCompanyNoteCount: Number(row.multiCompanyNoteCount),
        noteCount,
        unlinkedMessageCount,
        unlinkedNoteCount,
      },
      messages: row.messages ?? [],
      notes: row.notes ?? [],
      unlinkedMessages: row.unlinkedMessages ?? [],
      unlinkedNotes: row.unlinkedNotes ?? [],
    };
  }

  private buildSourceQuery(schemaName: string): string {
    return `
      WITH scoped_company AS (
        SELECT company.id, company.name
        FROM "${schemaName}"."company" AS company
        WHERE company."deletedAt" IS NULL
          AND (
            company."accountOwnerId" = $1
            OR company."createdByWorkspaceMemberId" = $1
            OR upper(btrim(company."erpsalesrepcode")) = ANY($2::text[])
          )
      ),
      scoped_person AS (
        SELECT person.id, person."companyId"
        FROM "${schemaName}"."person" AS person
        JOIN scoped_company ON scoped_company.id = person."companyId"
        WHERE person."deletedAt" IS NULL
      ),
      week_message AS (
        SELECT message.*
        FROM "${schemaName}"."message" AS message
        WHERE message."deletedAt" IS NULL
          AND message."isDraft" IS NOT TRUE
          AND message."receivedAt" >= $3
          AND message."receivedAt" <= $4
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
      qualified_message AS (
        SELECT DISTINCT week_message.id
        FROM week_message
        JOIN actor_message ON actor_message.id = week_message.id
        JOIN "${schemaName}"."messageParticipant" AS participant
          ON participant."messageId" = week_message.id
         AND participant."deletedAt" IS NULL
        JOIN scoped_person ON scoped_person.id = participant."personId"
      ),
      message_company AS (
        SELECT DISTINCT
          qualified_message.id AS "messageId",
          scoped_company.id,
          scoped_company.name
        FROM qualified_message
        JOIN "${schemaName}"."messageParticipant" AS participant
          ON participant."messageId" = qualified_message.id
         AND participant."deletedAt" IS NULL
        JOIN scoped_person ON scoped_person.id = participant."personId"
        JOIN scoped_company ON scoped_company.id = scoped_person."companyId"
      ),
      message_payload AS (
        SELECT
          week_message.id,
          jsonb_build_object(
            'id', week_message.id,
            'messageThreadId', week_message."messageThreadId",
            'subject', coalesce(week_message.subject, ''),
            'body', CASE WHEN $5::boolean THEN week_message.text ELSE NULL END,
            'receivedAt', week_message."receivedAt",
            'companies', coalesce((
              SELECT jsonb_agg(
                jsonb_build_object('id', link.id, 'name', link.name)
                ORDER BY link.name, link.id
              )
              FROM message_company AS link
              WHERE link."messageId" = week_message.id
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
        LIMIT $6
      ),
      unlinked_message_payload AS (
        SELECT
          week_message.id,
          jsonb_build_object(
            'id', week_message.id,
            'messageThreadId', week_message."messageThreadId",
            'subject', coalesce(week_message.subject, ''),
            'body', CASE WHEN $5::boolean THEN week_message.text ELSE NULL END,
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
            'reason', CASE
              WHEN NOT EXISTS (
                SELECT 1
                FROM "${schemaName}"."messageParticipant" AS participant
                WHERE participant."messageId" = week_message.id
                  AND participant."deletedAt" IS NULL
                  AND participant."personId" IS NOT NULL
              ) THEN 'NO_PERSON'
              WHEN NOT EXISTS (
                SELECT 1
                FROM "${schemaName}"."messageParticipant" AS participant
                JOIN "${schemaName}"."person" AS person
                  ON person.id = participant."personId"
                 AND person."deletedAt" IS NULL
                WHERE participant."messageId" = week_message.id
                  AND participant."deletedAt" IS NULL
                  AND person."companyId" IS NOT NULL
              ) THEN 'PERSON_WITHOUT_COMPANY'
              ELSE 'OUTSIDE_SCOPE_COMPANY'
            END
          ) AS payload
        FROM actor_message
        JOIN week_message ON week_message.id = actor_message.id
        WHERE NOT EXISTS (
          SELECT 1 FROM qualified_message WHERE qualified_message.id = actor_message.id
        )
        ORDER BY week_message."receivedAt", week_message.id
        LIMIT $6
      ),
      week_note AS (
        SELECT note.*
        FROM "${schemaName}"."note" AS note
        WHERE note."deletedAt" IS NULL
          AND note."createdByWorkspaceMemberId" = $1
          AND note."createdAt" >= $3
          AND note."createdAt" <= $4
      ),
      note_company_candidate AS (
        SELECT DISTINCT target."noteId", target."targetCompanyId" AS "companyId"
        FROM "${schemaName}"."noteTarget" AS target
        JOIN week_note ON week_note.id = target."noteId"
        WHERE target."deletedAt" IS NULL
          AND target."targetCompanyId" IS NOT NULL
        UNION
        SELECT DISTINCT target."noteId", person."companyId"
        FROM "${schemaName}"."noteTarget" AS target
        JOIN week_note ON week_note.id = target."noteId"
        JOIN "${schemaName}"."person" AS person
          ON person.id = target."targetPersonId"
         AND person."deletedAt" IS NULL
        WHERE target."deletedAt" IS NULL
          AND person."companyId" IS NOT NULL
        UNION
        SELECT DISTINCT target."noteId", opportunity."companyId"
        FROM "${schemaName}"."noteTarget" AS target
        JOIN week_note ON week_note.id = target."noteId"
        JOIN "${schemaName}"."opportunity" AS opportunity
          ON opportunity.id = target."targetOpportunityId"
         AND opportunity."deletedAt" IS NULL
        WHERE target."deletedAt" IS NULL
          AND opportunity."companyId" IS NOT NULL
      ),
      note_company AS (
        SELECT DISTINCT
          candidate."noteId",
          scoped_company.id,
          scoped_company.name
        FROM note_company_candidate AS candidate
        JOIN scoped_company ON scoped_company.id = candidate."companyId"
      ),
      qualified_note AS (
        SELECT DISTINCT week_note.id
        FROM week_note
        JOIN note_company ON note_company."noteId" = week_note.id
      ),
      note_payload AS (
        SELECT
          week_note.id,
          jsonb_build_object(
            'id', week_note.id,
            'title', coalesce(week_note.title, ''),
            'body', CASE WHEN $5::boolean THEN week_note."bodyV2Markdown" ELSE NULL END,
            'createdAt', week_note."createdAt",
            'companies', coalesce((
              SELECT jsonb_agg(
                jsonb_build_object('id', link.id, 'name', link.name)
                ORDER BY link.name, link.id
              )
              FROM note_company AS link
              WHERE link."noteId" = week_note.id
            ), '[]'::jsonb)
          ) AS payload
        FROM week_note
        JOIN qualified_note ON qualified_note.id = week_note.id
        ORDER BY week_note."createdAt", week_note.id
        LIMIT $6
      ),
      unlinked_note_payload AS (
        SELECT
          week_note.id,
          jsonb_build_object(
            'id', week_note.id,
            'title', coalesce(week_note.title, ''),
            'body', CASE WHEN $5::boolean THEN week_note."bodyV2Markdown" ELSE NULL END,
            'createdAt', week_note."createdAt",
            'reason', CASE
              WHEN EXISTS (
                SELECT 1
                FROM note_company_candidate AS candidate
                WHERE candidate."noteId" = week_note.id
              ) THEN 'OUTSIDE_SCOPE_COMPANY'
              ELSE 'NO_COMPANY'
            END
          ) AS payload
        FROM week_note
        WHERE NOT EXISTS (
          SELECT 1 FROM qualified_note WHERE qualified_note.id = week_note.id
        )
        ORDER BY week_note."createdAt", week_note.id
        LIMIT $6
      )
      SELECT
        (SELECT count(*) FROM scoped_company) AS "companyCount",
        (SELECT count(*) FROM scoped_person) AS "peopleCount",
        (SELECT count(*) FROM qualified_message) AS "qualifiedMessageCount",
        (
          SELECT count(*)
          FROM (
            SELECT "messageId"
            FROM message_company
            GROUP BY "messageId"
            HAVING count(*) > 1
          ) AS multi_company_message
        ) AS "multiCompanyMessageCount",
        (SELECT count(*) FROM qualified_note) AS "noteCount",
        (
          SELECT count(*)
          FROM (
            SELECT "noteId"
            FROM note_company
            GROUP BY "noteId"
            HAVING count(*) > 1
          ) AS multi_company_note
        ) AS "multiCompanyNoteCount",
        (SELECT count(*) FROM actor_message WHERE NOT EXISTS (
          SELECT 1 FROM qualified_message WHERE qualified_message.id = actor_message.id
        )) AS "unlinkedMessageCount",
        (SELECT count(*) FROM week_note WHERE NOT EXISTS (
          SELECT 1 FROM qualified_note WHERE qualified_note.id = week_note.id
        )) AS "unlinkedNoteCount",
        coalesce((SELECT jsonb_agg(payload ORDER BY id) FROM message_payload), '[]'::jsonb) AS messages,
        coalesce((SELECT jsonb_agg(payload ORDER BY id) FROM unlinked_message_payload), '[]'::jsonb) AS "unlinkedMessages",
        coalesce((SELECT jsonb_agg(payload ORDER BY id) FROM note_payload), '[]'::jsonb) AS notes,
        coalesce((SELECT jsonb_agg(payload ORDER BY id) FROM unlinked_note_payload), '[]'::jsonb) AS "unlinkedNotes"
    `;
  }
}
