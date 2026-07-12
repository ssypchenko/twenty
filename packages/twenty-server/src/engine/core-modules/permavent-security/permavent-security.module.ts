import { Module } from '@nestjs/common';

import { PermaventSalesRepAssignmentService } from 'src/engine/core-modules/permavent-security/assignments/permavent-sales-rep-assignment.service';
import { PermaventSecurityContextFactory } from 'src/engine/core-modules/permavent-security/context/permavent-security-context.factory';
import { PermaventAccessFilterBuilder } from 'src/engine/core-modules/permavent-security/filters/permavent-access-filter.builder';
import { PermaventSecurityService } from 'src/engine/core-modules/permavent-security/permavent-security.service';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';

@Module({
  imports: [WorkspaceCacheModule],
  providers: [
    PermaventSalesRepAssignmentService,
    PermaventAccessFilterBuilder,
    PermaventSecurityContextFactory,
    PermaventSecurityService,
  ],
  exports: [
    PermaventSalesRepAssignmentService,
    PermaventSecurityContextFactory,
    PermaventSecurityService,
  ],
})
export class PermaventSecurityModule {}
