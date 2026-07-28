import { SkeletonLoader } from '@/activities/components/SkeletonLoader';
import { AddTaskButton } from '@/activities/tasks/components/AddTaskButton';
import { TaskList } from '@/activities/tasks/components/TaskList';
import { useTasks } from '@/activities/tasks/hooks/useTasks';
import { sortOpenTasksForCompactWidget } from '@/activities/tasks/utils/sortOpenTasksForCompactWidget';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  overflow: auto;
`;

const StyledEmptyContainer = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  gap: ${themeCssVariables.spacing[4]};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[4]} ${themeCssVariables.spacing[6]};
`;

export const CompactTasksCard = () => {
  const targetRecord = useTargetRecord();
  const { tasks, tasksLoading } = useTasks({
    targetableObjects: [targetRecord],
  });
  const openTasks = sortOpenTasksForCompactWidget(tasks);

  if (tasksLoading && openTasks.length === 0) {
    return <SkeletonLoader />;
  }

  if (openTasks.length === 0) {
    return (
      <StyledEmptyContainer>
        <span>{t`No open tasks`}</span>
        <AddTaskButton activityTargetableObject={targetRecord} />
      </StyledEmptyContainer>
    );
  }

  return (
    <StyledContainer>
      <TaskList
        title={t`Open`}
        tasks={openTasks}
        button={<AddTaskButton activityTargetableObject={targetRecord} />}
        showTargets={false}
      />
    </StyledContainer>
  );
};
