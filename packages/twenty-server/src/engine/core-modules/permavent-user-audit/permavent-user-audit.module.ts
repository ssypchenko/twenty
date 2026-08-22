import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { PermissionsModule } from 'src/engine/metadata-modules/permissions/permissions.module';

import { PermaventUserAuditEntryEntity } from './permavent-user-audit-entry.entity';
import { RecordPermaventUserAuditJob } from './permavent-user-audit.job';
import { PermaventUserAuditService } from './permavent-user-audit.service';
import { PermaventUserAuditResolver } from './permavent-user-audit.resolver';
import { PermaventUserAuditCleanupCronCommand } from './cron/permavent-user-audit-cleanup.cron.command';
import { PermaventUserAuditCleanupCronJob } from './cron/permavent-user-audit-cleanup.cron.job';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PermaventUserAuditEntryEntity,
      FieldMetadataEntity,
    ]),
    PermissionsModule,
  ],
  providers: [
    PermaventUserAuditService,
    RecordPermaventUserAuditJob,
    PermaventUserAuditResolver,
    PermaventUserAuditCleanupCronJob,
    PermaventUserAuditCleanupCronCommand,
  ],
  exports: [PermaventUserAuditService, PermaventUserAuditCleanupCronCommand],
})
export class PermaventUserAuditModule {}
