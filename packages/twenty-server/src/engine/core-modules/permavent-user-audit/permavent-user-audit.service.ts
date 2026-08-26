import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { In, LessThan, Repository } from 'typeorm';
import { type ObjectRecordEvent } from 'twenty-shared/database-events';
import { FieldMetadataType } from 'twenty-shared/types';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';
import { WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';
import { PermaventUserAuditEntryEntity } from './permavent-user-audit-entry.entity';

const OMITTED_VALUE = '[VALUE_OMITTED]';
const SENSITIVE_FIELD =
  /password|token|secret|api.?key|oauth|encrypt|searchvector|position|updatedat|createdby|updatedby/i;
const RICH_TEXT_FIELD = /body|richtext|note/i;
const MAX_VALUE_LENGTH = 4096;
const OMITTED_FIELD_TYPES = new Set<FieldMetadataType>([
  FieldMetadataType.FILES,
  FieldMetadataType.MORPH_RELATION,
  FieldMetadataType.POSITION,
  FieldMetadataType.RAW_JSON,
  FieldMetadataType.RELATION,
  FieldMetadataType.RICH_TEXT,
  FieldMetadataType.TS_VECTOR,
]);

@Injectable()
export class PermaventUserAuditService {
  private readonly logger = new Logger(PermaventUserAuditService.name);
  constructor(
    // eslint-disable-next-line twenty/prefer-workspace-scoped-repository -- cleanup and queue jobs operate across workspaces; all reads are explicitly workspace-scoped.
    @InjectRepository(PermaventUserAuditEntryEntity)
    private readonly repository: Repository<PermaventUserAuditEntryEntity>,
    @InjectRepository(FieldMetadataEntity)
    private readonly fieldMetadataRepository: Repository<FieldMetadataEntity>,
    private readonly config: TwentyConfigService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async recordCrudBatch(
    batch: WorkspaceEventBatch<ObjectRecordEvent>,
  ): Promise<void> {
    if (
      !this.config.get('PERMAVENT_USER_AUDIT_ENABLED') ||
      !batch.objectMetadata.isAuditLogged
    )
      return;
    if (batch.objectMetadata.nameSingular === 'permaventuserauditentry') return;

    const action = this.actionFromName(batch.name);

    if (!action) return;

    const [fieldTypesByName, actorDisplayNamesByWorkspaceMemberId] =
      await Promise.all([
        this.getFieldTypesByName(batch.workspaceId, batch.objectMetadata.id),
        this.getActorDisplayNamesByWorkspaceMemberId(
          batch.workspaceId,
          batch.events
            .map((event) => event.workspaceMemberId)
            .filter((workspaceMemberId): workspaceMemberId is string =>
              Boolean(workspaceMemberId),
            ),
        ),
      ]);

    for (const event of batch.events) {
      if (!event.userWorkspaceId || !event.workspaceMemberId) continue;
      const properties = event.properties as {
        updatedFields?: string[];
        after?: Record<string, unknown>;
        before?: Record<string, unknown>;
        diff?: Record<string, { after?: unknown }>;
      };
      const capturesUpdatedValues = action === 'UPDATED';
      const capturesCreatedValues =
        action === 'CREATED' || action === 'UPSERTED';
      const fields = capturesUpdatedValues
        ? (properties.updatedFields ?? [])
        : capturesCreatedValues
          ? Object.keys(properties.after ?? {})
          : [];
      const newValues = capturesUpdatedValues
        ? this.sanitiseValues(properties.diff, true, fieldTypesByName)
        : capturesCreatedValues
          ? this.sanitiseValues(properties.after, false, fieldTypesByName)
          : {};
      const sourceEventId = this.sourceEventId(batch, event, action);
      try {
        await this.repository.insert({
          workspaceId: batch.workspaceId,
          userWorkspaceId: event.userWorkspaceId,
          workspaceMemberId: event.workspaceMemberId,
          actorDisplayName:
            actorDisplayNamesByWorkspaceMemberId.get(event.workspaceMemberId) ??
            null,
          action,
          result: 'SUCCESS',
          objectMetadataId: batch.objectMetadata.id,
          objectName: batch.objectMetadata.nameSingular,
          recordId: event.recordId,
          recordName:
            this.recordName(properties.after) ??
            this.recordName(properties.before),
          changedFields: fields.filter((field: string) =>
            Object.prototype.hasOwnProperty.call(newValues, field),
          ),
          newValues: newValues as never,
          denialCategory: null,
          sourceEventId,
        });
      } catch (error) {
        if ((error as { code?: string }).code !== '23505') throw error;
      }
    }
  }

  async find(
    workspaceId: string,
    input: {
      first?: number;
      after?: string;
      userWorkspaceId?: string;
      action?: string;
      objectName?: string;
      objectMetadataId?: string;
      recordId?: string;
      from?: Date;
      to?: Date;
    },
  ) {
    const query = this.repository
      .createQueryBuilder('entry')
      .where('entry.workspaceId = :workspaceId', { workspaceId })
      .orderBy('entry.createdAt', 'DESC')
      .addOrderBy('entry.id', 'DESC')
      .take(Math.min(input.first ?? 50, 200));
    if (input.after)
      query.andWhere('entry.createdAt < :after', {
        after: new Date(input.after),
      });
    if (input.userWorkspaceId)
      query.andWhere('entry.userWorkspaceId = :userWorkspaceId', input);
    if (input.action) query.andWhere('entry.action = :action', input);
    if (input.objectName)
      query.andWhere('entry.objectName = :objectName', input);
    if (input.objectMetadataId)
      query.andWhere('entry.objectMetadataId = :objectMetadataId', input);
    if (input.recordId) query.andWhere('entry.recordId = :recordId', input);
    if (input.from) query.andWhere('entry.createdAt >= :from', input);
    if (input.to) query.andWhere('entry.createdAt <= :to', input);
    const entries = await query.getMany();
    return {
      entries,
      endCursor: entries[entries.length - 1]?.createdAt.toISOString() ?? null,
      hasNextPage: entries.length === (input.first ?? 50),
    };
  }

  async cleanupExpired(batchSize = 1000): Promise<number> {
    if (!this.config.get('PERMAVENT_USER_AUDIT_ENABLED')) return 0;
    const threshold = new Date(
      Date.now() -
        this.config.get('PERMAVENT_USER_AUDIT_RETENTION_DAYS') * 86400000,
    );
    let totalDeleted = 0;
    let deletedCount = batchSize;
    while (deletedCount === batchSize) {
      const expired = await this.repository.find({
        where: { createdAt: LessThan(threshold) },
        select: { id: true },
        take: batchSize,
      });
      deletedCount = expired.length;
      if (deletedCount)
        await this.repository.delete(expired.map(({ id }) => id));
      totalDeleted += deletedCount;
    }
    return totalDeleted;
  }

  private actionFromName(name: string) {
    const parts = name.split('.');
    const action = parts[parts.length - 1]?.toUpperCase();
    return [
      'CREATED',
      'UPDATED',
      'DELETED',
      'RESTORED',
      'DESTROYED',
      'UPSERTED',
    ].includes(action ?? '')
      ? action
      : null;
  }
  private sourceEventId(
    batch: WorkspaceEventBatch<ObjectRecordEvent>,
    event: ObjectRecordEvent,
    action: string,
  ) {
    return this.hash(
      JSON.stringify({
        workspaceId: batch.workspaceId,
        objectMetadataId: batch.objectMetadata.id,
        action,
        recordId: event.recordId,
        userWorkspaceId: event.userWorkspaceId,
        properties: event.properties,
      }),
    );
  }
  private hash(value: string) {
    return createHash('sha256').update(String(value)).digest('hex');
  }
  private recordName(record: unknown): string | null {
    if (!record || typeof record !== 'object') return null;
    const values = record as Record<string, unknown>;
    return (
      ['name', 'title', 'displayName']
        .map((key) => values[key])
        .find((value): value is string => typeof value === 'string') ?? null
    );
  }
  private sanitiseValues(
    values: unknown,
    isDiff: boolean,
    fieldTypesByName: Map<string, FieldMetadataType>,
  ): Record<string, unknown> {
    if (!values || typeof values !== 'object') return {};
    return Object.fromEntries(
      Object.entries(values as Record<string, unknown>)
        .map(([field, value]) => [
          field,
          this.sanitise(
            field,
            isDiff && value && typeof value === 'object'
              ? (value as { after?: unknown }).after
              : value,
            fieldTypesByName.get(field),
          ),
        ])
        .filter(
          ([field]) =>
            typeof field === 'string' && !SENSITIVE_FIELD.test(field),
        ),
    );
  }
  private sanitise(
    field: string,
    value: unknown,
    fieldType: FieldMetadataType | undefined,
  ): unknown {
    if (RICH_TEXT_FIELD.test(field) || OMITTED_FIELD_TYPES.has(fieldType!))
      return OMITTED_VALUE;
    if (value && typeof value === 'object' && !fieldType) return OMITTED_VALUE;

    return this.isWithinValueLimit(value) ? value : OMITTED_VALUE;
  }
  private isWithinValueLimit(value: unknown): boolean {
    try {
      const serialisedValue = JSON.stringify(value);

      return (
        typeof serialisedValue === 'string' &&
        serialisedValue.length <= MAX_VALUE_LENGTH
      );
    } catch {
      return false;
    }
  }
  private async getFieldTypesByName(
    workspaceId: string,
    objectMetadataId: string,
  ): Promise<Map<string, FieldMetadataType>> {
    try {
      const fields = await this.fieldMetadataRepository.find({
        where: { workspaceId, objectMetadataId },
        select: { name: true, type: true },
      });

      return new Map(fields.map((field) => [field.name, field.type]));
    } catch (error) {
      this.logger.error(
        'Permavent user audit field metadata lookup failed',
        error,
      );

      return new Map();
    }
  }
  private async getActorDisplayNamesByWorkspaceMemberId(
    workspaceId: string,
    workspaceMemberIds: string[],
  ): Promise<Map<string, string>> {
    const uniqueWorkspaceMemberIds = [...new Set(workspaceMemberIds)];

    if (uniqueWorkspaceMemberIds.length === 0) return new Map();

    try {
      return await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const workspaceMemberRepository =
            await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberWorkspaceEntity>(
              'workspaceMember',
              { shouldBypassPermissionChecks: true },
            );
          const workspaceMembers = await workspaceMemberRepository.find({
            where: { id: In(uniqueWorkspaceMemberIds) },
          });

          return new Map(
            workspaceMembers.flatMap((workspaceMember) => {
              const displayName = [
                workspaceMember.name?.firstName,
                workspaceMember.name?.lastName,
              ]
                .filter(Boolean)
                .join(' ');

              return displayName
                ? ([[workspaceMember.id, displayName]] as const)
                : [];
            }),
          );
        },
        buildSystemAuthContext(workspaceId),
        { lite: true },
      );
    } catch (error) {
      this.logger.error('Permavent user audit actor lookup failed', error);

      return new Map();
    }
  }
}
