import { type Task } from '@/activities/types/Task';

const getTimestamp = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? null : timestamp;
};

export const sortOpenTasksForCompactWidget = (tasks: Task[]): Task[] =>
  tasks
    .filter(({ status }) => status !== 'DONE')
    .toSorted((taskA, taskB) => {
      const dueAtA = getTimestamp(taskA.dueAt);
      const dueAtB = getTimestamp(taskB.dueAt);

      if (dueAtA !== null && dueAtB !== null && dueAtA !== dueAtB) {
        return dueAtA - dueAtB;
      }

      if (dueAtA !== null) {
        return -1;
      }

      if (dueAtB !== null) {
        return 1;
      }

      return (
        (getTimestamp(taskB.createdAt) ?? 0) -
        (getTimestamp(taskA.createdAt) ?? 0)
      );
    });
