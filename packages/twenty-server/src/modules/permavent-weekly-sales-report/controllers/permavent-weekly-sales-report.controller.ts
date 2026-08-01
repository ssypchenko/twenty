import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { PermaventWeeklySalesReportSourceRequestDto } from 'src/modules/permavent-weekly-sales-report/dtos/permavent-weekly-sales-report-source-request.dto';
import { PermaventWeeklySalesReportSourceService } from 'src/modules/permavent-weekly-sales-report/services/permavent-weekly-sales-report-source.service';
import { type PermaventWeeklySalesReportSource } from 'src/modules/permavent-weekly-sales-report/types/permavent-weekly-sales-report-source.type';

@Controller('rest/permavent/weekly-sales-report')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
export class PermaventWeeklySalesReportController {
  constructor(
    private readonly sourceService: PermaventWeeklySalesReportSourceService,
  ) {}

  @Post('source')
  async getSource(
    @Body() request: PermaventWeeklySalesReportSourceRequestDto,
  ): Promise<PermaventWeeklySalesReportSource> {
    return this.sourceService.getSource({
      authContext: getWorkspaceAuthContext(),
      includeBody: request.includeBody !== false,
    });
  }
}
