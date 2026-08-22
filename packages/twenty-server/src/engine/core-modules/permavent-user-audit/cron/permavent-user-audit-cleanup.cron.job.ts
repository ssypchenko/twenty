import { Injectable, Logger } from '@nestjs/common';

import { SentryCronMonitor } from 'src/engine/core-modules/cron/sentry-cron-monitor.decorator';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { PERMAVENT_USER_AUDIT_CLEANUP_CRON_PATTERN } from 'src/engine/core-modules/permavent-user-audit/constants/permavent-user-audit-cleanup-cron-pattern.constant';
import { PermaventUserAuditService } from 'src/engine/core-modules/permavent-user-audit/permavent-user-audit.service';

@Injectable()
@Processor(MessageQueue.cronQueue)
export class PermaventUserAuditCleanupCronJob {
  private readonly logger = new Logger(PermaventUserAuditCleanupCronJob.name);

  constructor(private readonly auditService: PermaventUserAuditService) {}

  @Process(PermaventUserAuditCleanupCronJob.name)
  @SentryCronMonitor(
    PermaventUserAuditCleanupCronJob.name,
    PERMAVENT_USER_AUDIT_CLEANUP_CRON_PATTERN,
  )
  async handle(): Promise<void> {
    const deletedCount = await this.auditService.cleanupExpired();
    if (deletedCount > 0)
      this.logger.log(`Deleted ${deletedCount} expired user audit entries`);
  }
}
