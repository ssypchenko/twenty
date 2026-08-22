import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { LessThan, Repository } from 'typeorm';
import { type ObjectRecordEvent } from 'twenty-shared/database-events';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { type WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';
import { PermaventUserAuditEntryEntity } from './permavent-user-audit-entry.entity';

const OMITTED_VALUE = '[VALUE_OMITTED]';
const SENSITIVE_FIELD =
  /password|token|secret|api.?key|oauth|encrypt|searchvector|position|updatedat|createdby|updatedby/i;
const RICH_TEXT_FIELD = /body|richtext|note/i;
const MAX_VALUE_LENGTH = 4096;

@Injectable()
export class PermaventUserAuditService {
  private readonly logger = new Logger(PermaventUserAuditService.name);
  constructor(
    // eslint-disable-next-line twenty/prefer-workspace-scoped-repository -- cleanup and queue jobs operate across workspaces; all reads are explicitly workspace-scoped.
    @InjectRepository(PermaventUserAuditEntryEntity)
    private readonly repository: Repository<PermaventUserAuditEntryEntity>,
    private readonly config: TwentyConfigService,
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
    for (const event of batch.events) {
      if (!event.userWorkspaceId || !event.workspaceMemberId) continue;
      const action = this.actionFromName(batch.name);
      if (!action) continue;
      const properties = event.properties as {
        updatedFields?: string[];
        after?: Record<string, unknown>;
        before?: Record<string, unknown>;
        diff?: Record<string, { after?: unknown }>;
      };
      const fields =
        action === 'UPDATED'
          ? (properties.updatedFields ?? [])
          : Object.keys(properties.after ?? {});
      const newValues = this.sanitiseValues(
        action === 'UPDATED' ? properties.diff : properties.after,
        action === 'UPDATED',
      );
      const sourceEventId = this.sourceEventId(batch, event, action);
      try {
        await this.repository.insert({
          workspaceId: batch.workspaceId,
          userWorkspaceId: event.userWorkspaceId,
          workspaceMemberId: event.workspaceMemberId,
          actorDisplayName: null,
          action,
          result: 'SUCCESS',
          objectMetadataId: batch.objectMetadata.id,
          objectName: batch.objectMetadata.nameSingular,
          recordId: event.recordId,
          recordName: this.recordName(properties.after ?? properties.before),
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

  async recordRlsDenied(input: {
    workspaceId: string;
    userWorkspaceId?: string;
    workspaceMemberId?: string;
    objectName: string;
    action: string;
    category: string;
  }): Promise<void> {
    if (
      !this.config.get('PERMAVENT_USER_AUDIT_ENABLED') ||
      !input.userWorkspaceId ||
      !input.workspaceMemberId
    )
      return;
    try {
      await this.repository.insert({
        workspaceId: input.workspaceId,
        userWorkspaceId: input.userWorkspaceId,
        workspaceMemberId: input.workspaceMemberId,
        actorDisplayName: null,
        action: 'RLS_DENIED',
        result: 'DENIED',
        objectMetadataId: null,
        objectName: input.objectName,
        recordId: null,
        recordName: null,
        changedFields: [],
        newValues: {},
        denialCategory: input.category,
        sourceEventId: this.hash(JSON.stringify(input)),
      });
    } catch (error) {
      this.logger.error(
        'Permavent user audit denial persistence failed',
        error,
      );
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
          ),
        ])
        .filter(
          ([field]) =>
            typeof field === 'string' && !SENSITIVE_FIELD.test(field),
        ),
    );
  }
  private sanitise(field: string, value: unknown): unknown {
    if (RICH_TEXT_FIELD.test(field) || (value && typeof value === 'object'))
      return OMITTED_VALUE;
    const stringValue = String(value ?? '');
    return stringValue.length > MAX_VALUE_LENGTH ? OMITTED_VALUE : value;
  }
}
