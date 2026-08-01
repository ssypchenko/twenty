import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { PermaventSecurityModule } from 'src/engine/core-modules/permavent-security/permavent-security.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { PermaventWeeklySalesReportController } from 'src/modules/permavent-weekly-sales-report/controllers/permavent-weekly-sales-report.controller';
import { PermaventWeeklySalesReportSourceService } from 'src/modules/permavent-weekly-sales-report/services/permavent-weekly-sales-report-source.service';

@Module({
  imports: [AuthModule, PermaventSecurityModule, WorkspaceCacheStorageModule],
  controllers: [PermaventWeeklySalesReportController],
  providers: [PermaventWeeklySalesReportSourceService],
})
export class PermaventWeeklySalesReportModule {}
