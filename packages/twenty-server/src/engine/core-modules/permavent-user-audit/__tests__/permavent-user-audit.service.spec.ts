import { type Repository } from 'typeorm';
import { type ObjectRecordEvent } from 'twenty-shared/database-events';
import { FieldMetadataType } from 'twenty-shared/types';

import { PermaventUserAuditEntryEntity } from 'src/engine/core-modules/permavent-user-audit/permavent-user-audit-entry.entity';
import { PermaventUserAuditService } from 'src/engine/core-modules/permavent-user-audit/permavent-user-audit.service';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { type FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { type GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-orm.manager';
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
  const createQueryBuilder = jest.fn();
  const repository = {
    insert,
    createQueryBuilder,
  } as unknown as Repository<PermaventUserAuditEntryEntity>;
  const findFieldMetadata = jest.fn();
  const fieldMetadataRepository = {
    find: findFieldMetadata,
  } as unknown as Repository<FieldMetadataEntity>;
  const findWorkspaceMembers = jest.fn();
  const workspaceMemberRepository = {
    find: findWorkspaceMembers,
  };
  const globalWorkspaceOrmManager = {
    executeInWorkspaceContext: jest.fn(async (callback) => callback()),
    getRepository: jest.fn().mockResolvedValue(workspaceMemberRepository),
  } as unknown as GlobalWorkspaceOrmManager;
  const config = {
    get: jest.fn((key: string) =>
      key === 'PERMAVENT_USER_AUDIT_ENABLED' ? true : 365,
    ),
  } as unknown as TwentyConfigService;
  const service = new PermaventUserAuditService(
    repository,
    fieldMetadataRepository,
    config,
    globalWorkspaceOrmManager,
  );

  beforeEach(() => {
    insert.mockReset();
    insert.mockResolvedValue(undefined);
    findFieldMetadata.mockReset();
    findFieldMetadata.mockResolvedValue([]);
    findWorkspaceMembers.mockReset();
    findWorkspaceMembers.mockResolvedValue([
      {
        id: '60606060-6060-4060-8060-606060606060',
        name: { firstName: 'Ada', lastName: 'Lovelace' },
      },
    ]);
    createQueryBuilder.mockReset();
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
        actorDisplayName: 'Ada Lovelace',
        changedFields: ['name', 'noteBody', 'rawData'],
        newValues: {
          name: 'Permavent',
          noteBody: '[VALUE_OMITTED]',
          rawData: '[VALUE_OMITTED]',
        },
      }),
    );
  });

  it('preserves safe standard composite values', async () => {
    findFieldMetadata.mockResolvedValue([
      { name: 'address', type: FieldMetadataType.ADDRESS },
      { name: 'companyType', type: FieldMetadataType.SELECT },
      { name: 'rawData', type: FieldMetadataType.RAW_JSON },
    ]);

    await service.recordCrudBatch(
      createBatch('company.updated', {
        updatedFields: ['address', 'companyType', 'rawData'],
        diff: {
          address: {
            after: { addressStreet1: '42 Example Street', addressCity: 'York' },
          },
          companyType: { after: { value: 'CUSTOMER', label: 'Customer' } },
          rawData: { after: { internal: 'not stored' } },
        },
      }),
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATED',
        changedFields: ['address', 'companyType', 'rawData'],
        newValues: {
          address: {
            addressStreet1: '42 Example Street',
            addressCity: 'York',
          },
          companyType: { value: 'CUSTOMER', label: 'Customer' },
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

  it('filters audit entries by stable object metadata ID', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    createQueryBuilder.mockReturnValue(queryBuilder);

    await service.find('20202020-2020-4020-8020-202020202020', {
      objectMetadataId: '30303030-3030-4030-8030-303030303030',
      from: new Date('2026-08-22T00:00:00.000Z'),
      to: new Date('2026-08-22T23:59:59.999Z'),
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'entry.objectMetadataId = :objectMetadataId',
      expect.objectContaining({
        objectMetadataId: '30303030-3030-4030-8030-303030303030',
      }),
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'entry.createdAt >= :from',
      expect.objectContaining({ from: expect.any(Date) }),
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'entry.createdAt <= :to',
      expect.objectContaining({ to: expect.any(Date) }),
    );
  });
});
