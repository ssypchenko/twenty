import { Command, CommandRunner } from 'nest-commander';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { PERMAVENT_USER_AUDIT_CLEANUP_CRON_PATTERN } from 'src/engine/core-modules/permavent-user-audit/constants/permavent-user-audit-cleanup-cron-pattern.constant';
import { PermaventUserAuditCleanupCronJob } from 'src/engine/core-modules/permavent-user-audit/cron/permavent-user-audit-cleanup.cron.job';

@Command({
  name: 'cron:permavent-user-audit:cleanup',
  description:
    'Starts the daily cleanup of expired Permavent user audit entries',
})
export class PermaventUserAuditCleanupCronCommand extends CommandRunner {
  constructor(
    @InjectMessageQueue(MessageQueue.cronQueue)
    private readonly queue: MessageQueueService,
  ) {
    super();
  }

  async run(): Promise<void> {
    await this.queue.addCron<undefined>({
      jobName: PermaventUserAuditCleanupCronJob.name,
      data: undefined,
      options: {
        repeat: { pattern: PERMAVENT_USER_AUDIT_CLEANUP_CRON_PATTERN },
      },
    });
  }
}
