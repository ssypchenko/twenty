import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PermaventSalesRepAssignmentService } from 'src/engine/core-modules/permavent-security/assignments/permavent-sales-rep-assignment.service';
import { PermaventSecurityContextFactory } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.factory';
import { PermaventAccessFilterBuilder } from 'src/engine/core-modules/permavent-security/filters/permavent-access-filter.builder';
import { PermaventSecurityService } from 'src/engine/core-modules/permavent-security/permavent-security.service';
import { PermaventDelegatedContextService } from 'src/engine/core-modules/permavent-security/delegated-context/services/permavent-delegated-context.service';
import { PermaventDelegatedAuditService } from 'src/engine/core-modules/permavent-security/audit/permavent-delegated-audit.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { CoreEntityCacheModule } from 'src/engine/core-entity-cache/core-entity-cache.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';

@Module({
  imports: [
    CoreEntityCacheModule,
    TypeOrmModule.forFeature([UserWorkspaceEntity]),
    WorkspaceCacheModule,
  ],
  providers: [
    PermaventSalesRepAssignmentService,
    PermaventAccessFilterBuilder,
    PermaventSecurityContextFactory,
    PermaventSecurityService,
    PermaventDelegatedAuditService,
    PermaventDelegatedContextService,
  ],
  exports: [
    PermaventSalesRepAssignmentService,
    PermaventSecurityContextFactory,
    PermaventSecurityService,
    PermaventDelegatedAuditService,
    PermaventDelegatedContextService,
  ],
})
export class PermaventSecurityModule {}
