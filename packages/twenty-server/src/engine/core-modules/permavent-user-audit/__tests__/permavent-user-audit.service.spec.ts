import { type Repository } from 'typeorm';
import { type ObjectRecordEvent } from 'twenty-shared/database-events';

import { PermaventUserAuditEntryEntity } from 'src/engine/core-modules/permavent-user-audit/permavent-user-audit-entry.entity';
import { PermaventUserAuditService } from 'src/engine/core-modules/permavent-user-audit/permavent-user-audit.service';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { type WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';

const createBatch = (
  name: string,
  properties: Record<string, unknown>,
): WorkspaceEventBatch<ObjectRecordEvent> =>
  ({
    name,
    workspaceId: '20202020-2020-4020-8020-202020202020',
    objectMetadata: {
      id: '30303030-3030-4030-8030-303030303030',
      nameSingular: 'company',
      isAuditLogged: true,
    },
    events: [
      {
        recordId: '40404040-4040-4040-8040-404040404040',
        userWorkspaceId: '50505050-5050-4050-8050-505050505050',
        workspaceMemberId: '60606060-6060-4060-8060-606060606060',
        properties,
      },
    ],
  }) as unknown as WorkspaceEventBatch<ObjectRecordEvent>;

describe('PermaventUserAuditService', () => {
  const insert = jest.fn();
  const repository = {
    insert,
  } as unknown as Repository<PermaventUserAuditEntryEntity>;
  const config = {
    get: jest.fn((key: string) =>
      key === 'PERMAVENT_USER_AUDIT_ENABLED' ? true : 365,
    ),
  } as unknown as TwentyConfigService;
  const service = new PermaventUserAuditService(repository, config);

  beforeEach(() => {
    insert.mockReset();
    insert.mockResolvedValue(undefined);
  });

  it('stores sanitised created values', async () => {
    await service.recordCrudBatch(
      createBatch('company.created', {
        after: {
          name: 'Permavent',
          password: 'not-stored',
          noteBody: 'not-stored',
          rawData: { technical: true },
        },
      }),
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATED',
        changedFields: ['name', 'noteBody', 'rawData'],
        newValues: {
          name: 'Permavent',
          noteBody: '[VALUE_OMITTED]',
          rawData: '[VALUE_OMITTED]',
        },
      }),
    );
  });

  it('stores delete actions without field values', async () => {
    await service.recordCrudBatch(
      createBatch('company.destroyed', {
        after: {},
        before: { name: 'Deleted company', revenue: 100 },
      }),
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DESTROYED',
        recordName: 'Deleted company',
        changedFields: [],
        newValues: {},
      }),
    );
  });

  it('does not deduplicate separate RLS denials', async () => {
    const denial = {
      workspaceId: '20202020-2020-4020-8020-202020202020',
      userWorkspaceId: '50505050-5050-4050-8050-505050505050',
      workspaceMemberId: '60606060-6060-4060-8060-606060606060',
      objectName: 'company',
      action: 'UPSERT',
      category: 'UPSERT_DENIED',
    };

    await service.recordRlsDenied(denial);
    await service.recordRlsDenied(denial);

    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sourceEventId: null }),
    );
    expect(insert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sourceEventId: null }),
    );
  });
});
