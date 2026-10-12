import { Module } from '@nestjs/common';

import { PermaventSalesRepAssignmentService } from 'src/engine/core-modules/permavent-sales-scope/assignments/permavent-sales-rep-assignment.service';
import { PermaventSalesScopeContextFactory } from 'src/engine/core-modules/permavent-sales-scope/context/permavent-sales-scope-context.factory';
import { PermaventCompanyFocusFilterService } from 'src/engine/core-modules/permavent-sales-scope/focus/permavent-company-focus-filter.service';
import { PermaventSalesScopeService } from 'src/engine/core-modules/permavent-sales-scope/permavent-sales-scope.service';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';

@Module({
  imports: [WorkspaceCacheModule],
  providers: [
    PermaventSalesRepAssignmentService,
    PermaventSalesScopeContextFactory,
    PermaventCompanyFocusFilterService,
    PermaventSalesScopeService,
  ],
  exports: [
    PermaventSalesScopeContextFactory,
    PermaventCompanyFocusFilterService,
    PermaventSalesScopeService,
  ],
})
export class PermaventSalesScopeModule {}
