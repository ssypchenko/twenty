import { type ObjectRecordEvent } from 'twenty-shared/database-events';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { type WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';
import { PermaventUserAuditService } from './permavent-user-audit.service';

@Processor(MessageQueue.entityEventsToDbQueue)
export class RecordPermaventUserAuditJob {
  constructor(private readonly auditService: PermaventUserAuditService) {}
  @Process(RecordPermaventUserAuditJob.name)
  async handle(batch: WorkspaceEventBatch<ObjectRecordEvent>): Promise<void> {
    await this.auditService.recordCrudBatch(batch);
  }
}
