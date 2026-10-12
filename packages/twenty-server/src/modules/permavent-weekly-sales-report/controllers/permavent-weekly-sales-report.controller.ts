import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { AuthPrincipalGuard } from 'src/engine/guards/auth-principal.guard';
import { WorkspaceNotSuspendedGuard } from 'src/engine/guards/workspace-not-suspended.guard';
import { PermaventWeeklySalesReportSourceRequestDto } from 'src/modules/permavent-weekly-sales-report/dtos/permavent-weekly-sales-report-source-request.dto';
import { PermaventWeeklySalesReportSourceService } from 'src/modules/permavent-weekly-sales-report/services/permavent-weekly-sales-report-source.service';
import { type PermaventWeeklySalesReportSource } from 'src/modules/permavent-weekly-sales-report/types/permavent-weekly-sales-report-source.type';

@Controller('rest/permavent/weekly-sales-report')
@UseGuards(
  JwtAuthGuard,
  AuthPrincipalGuard({
    userSession: {
      standard: true,
      impersonated: false,
      playground: false,
      workspaceAgnostic: false,
    },
    apiKey: true,
    oauthClient: false,
    application: false,
  }),
  WorkspaceNotSuspendedGuard,
  NoPermissionGuard,
)
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
