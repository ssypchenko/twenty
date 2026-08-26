jest.mock(
  'src/engine/core-modules/event-logs/ingest/create-event-log-from-internal-event',
  () => ({
    CreateEventLogFromInternalEvent: class CreateEventLogFromInternalEvent {},
  }),
);
jest.mock(
  'src/engine/core-modules/logic-function/logic-function-trigger/triggers/database-event/call-database-event-trigger-jobs.job',
  () => ({
    CallDatabaseEventTriggerJobsJob: class CallDatabaseEventTriggerJobsJob {},
  }),
);
jest.mock(
  'src/engine/core-modules/permavent-user-audit/permavent-user-audit.job',
  () => ({
    RecordPermaventUserAuditJob: class RecordPermaventUserAuditJob {},
  }),
);
jest.mock(
  'src/engine/metadata-modules/webhook/jobs/call-webhook-jobs.job',
  () => ({
    CallWebhookJobsJob: class CallWebhookJobsJob {},
  }),
);

import { CreateEventLogFromInternalEvent } from 'src/engine/core-modules/event-logs/ingest/create-event-log-from-internal-event';
import { RecordPermaventUserAuditJob } from 'src/engine/core-modules/permavent-user-audit/permavent-user-audit.job';
import { EntityEventsToDbListener } from 'src/engine/api/graphql/workspace-query-runner/listeners/entity-events-to-db.listener';
import { CallDatabaseEventTriggerJobsJob } from 'src/engine/core-modules/logic-function/logic-function-trigger/triggers/database-event/call-database-event-trigger-jobs.job';
import { CallWebhookJobsJob } from 'src/engine/metadata-modules/webhook/jobs/call-webhook-jobs.job';

describe('EntityEventsToDbListener', () => {
  it('queues the Permavent audit job for audit-logged CRUD events', async () => {
    const entityEventsToDbQueueService = {
      add: jest.fn().mockResolvedValue(undefined),
    };
    const webhookQueueService = { add: jest.fn().mockResolvedValue(undefined) };
    const triggerQueueService = { add: jest.fn().mockResolvedValue(undefined) };
    const objectRecordEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    const timelineActivityRoutingPlanService = {
      shouldProcessEvent: jest.fn().mockResolvedValue(false),
    };
    const listener = new EntityEventsToDbListener(
      entityEventsToDbQueueService as never,
      webhookQueueService as never,
      triggerQueueService as never,
      objectRecordEventPublisher as never,
      timelineActivityRoutingPlanService as never,
    );
    const batchEvent = {
      name: 'company.created',
      workspaceId: '20202020-2020-4020-8020-202020202020',
      objectMetadata: {
        id: '30303030-3030-4030-8030-303030303030',
        nameSingular: 'company',
        universalIdentifier: '40404040-4040-4040-8040-404040404040',
        isAuditLogged: true,
      },
      events: [],
    };

    await listener.handleCreate(batchEvent as never);

    expect(webhookQueueService.add).toHaveBeenCalledWith(
      CallWebhookJobsJob.name,
      expect.objectContaining({
        objectMetadata: expect.objectContaining({ id: expect.any(String) }),
      }),
      { retryLimit: 3 },
    );
    expect(triggerQueueService.add).toHaveBeenCalledWith(
      CallDatabaseEventTriggerJobsJob.name,
      batchEvent,
      { retryLimit: 3 },
    );
    expect(entityEventsToDbQueueService.add).toHaveBeenCalledWith(
      CreateEventLogFromInternalEvent.name,
      batchEvent,
      { retryLimit: 1 },
    );
    expect(entityEventsToDbQueueService.add).toHaveBeenCalledWith(
      RecordPermaventUserAuditJob.name,
      batchEvent,
      { retryLimit: 3 },
    );
  });
});
