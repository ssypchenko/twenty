import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PermaventSalesRepAssignmentEntity } from 'src/engine/core-modules/permavent-security/assignments/permavent-sales-rep-assignment.entity';
import { PermaventSalesRepAssignmentService } from 'src/engine/core-modules/permavent-security/assignments/permavent-sales-rep-assignment.service';
import { PermaventSecurityContextFactory } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.factory';
import { PermaventAccessFilterBuilder } from 'src/engine/core-modules/permavent-security/filters/permavent-access-filter.builder';
import { PermaventSecurityService } from 'src/engine/core-modules/permavent-security/permavent-security.service';
import { provideWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/provide-workspace-scoped-repository';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PermaventSalesRepAssignmentEntity]),
    WorkspaceCacheModule,
  ],
  providers: [
    PermaventSalesRepAssignmentService,
    PermaventAccessFilterBuilder,
    PermaventSecurityContextFactory,
    PermaventSecurityService,
    provideWorkspaceScopedRepository(PermaventSalesRepAssignmentEntity),
  ],
  exports: [
    PermaventSalesRepAssignmentService,
    PermaventSecurityContextFactory,
    PermaventSecurityService,
  ],
})
export class PermaventSecurityModule {}
