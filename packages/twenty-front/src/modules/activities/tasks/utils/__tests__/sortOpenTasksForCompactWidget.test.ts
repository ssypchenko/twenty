import { type Task } from '@/activities/types/Task';
import { sortOpenTasksForCompactWidget } from '@/activities/tasks/utils/sortOpenTasksForCompactWidget';

const createTask = ({
  id,
  status = 'TODO',
  dueAt = null,
  createdAt = '2026-07-01T09:00:00.000Z',
}: {
  id: string;
  status?: Task['status'];
  dueAt?: string | null;
  createdAt?: string;
}): Task =>
  ({
    id,
    status,
    dueAt,
    createdAt,
  }) as Task;

describe('sortOpenTasksForCompactWidget', () => {
  it('should exclude completed tasks and sort dated tasks by due date', () => {
    const tasks = [
      createTask({ id: 'undated' }),
      createTask({ id: 'later', dueAt: '2026-07-30T09:00:00.000Z' }),
      createTask({ id: 'done', status: 'DONE' }),
      createTask({ id: 'earlier', dueAt: '2026-07-29T09:00:00.000Z' }),
    ];

    expect(sortOpenTasksForCompactWidget(tasks).map(({ id }) => id)).toEqual([
      'earlier',
      'later',
      'undated',
    ]);
  });

  it('should put invalid and missing due dates last, newest created first', () => {
    const tasks = [
      createTask({
        id: 'older-undated',
        createdAt: '2026-07-01T09:00:00.000Z',
      }),
      createTask({
        id: 'invalid-due-date',
        dueAt: 'invalid',
        createdAt: '2026-07-03T09:00:00.000Z',
      }),
      createTask({
        id: 'newer-undated',
        createdAt: '2026-07-02T09:00:00.000Z',
      }),
    ];

    expect(sortOpenTasksForCompactWidget(tasks).map(({ id }) => id)).toEqual([
      'invalid-due-date',
      'newer-undated',
      'older-undated',
    ]);
  });

  it('should not mutate the source array', () => {
    const tasks = [
      createTask({ id: 'later', dueAt: '2026-07-30T09:00:00.000Z' }),
      createTask({ id: 'earlier', dueAt: '2026-07-29T09:00:00.000Z' }),
    ];

    sortOpenTasksForCompactWidget(tasks);

    expect(tasks.map(({ id }) => id)).toEqual(['later', 'earlier']);
  });
});
