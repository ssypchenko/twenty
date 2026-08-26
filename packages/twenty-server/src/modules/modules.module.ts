import { Module } from '@nestjs/common';

import { CalendarModule } from 'src/modules/calendar/calendar.module';
import { ConnectedAccountModule } from 'src/modules/connected-account/connected-account.module';
import { MessagingModule } from 'src/modules/messaging/messaging.module';
import { OnboardingInviteSuggestionsModule } from 'src/modules/onboarding-invite-suggestions/onboarding-invite-suggestions.module';
import { PermaventWeeklySalesReportModule } from 'src/modules/permavent-weekly-sales-report/permavent-weekly-sales-report.module';
import { WorkflowModule } from 'src/modules/workflow/workflow.module';
import { WorkspaceMemberModule } from 'src/modules/workspace-member/workspace-member.module';

@Module({
  imports: [
    MessagingModule,
    CalendarModule,
    ConnectedAccountModule,
    OnboardingInviteSuggestionsModule,
    PermaventWeeklySalesReportModule,
    WorkflowModule,
    WorkspaceMemberModule,
  ],
  providers: [],
  exports: [],
})
export class ModulesModule {}
