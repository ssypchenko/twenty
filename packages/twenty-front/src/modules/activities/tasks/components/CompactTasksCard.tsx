import { ActivityList } from '@/activities/components/ActivityList';
import { SkeletonLoader } from '@/activities/components/SkeletonLoader';
import { useCreateActivityForTargetRecord } from '@/activities/hooks/useCreateActivityForTargetRecord';
import { TaskRow } from '@/activities/tasks/components/TaskRow';
import { useTasks } from '@/activities/tasks/hooks/useTasks';
import { sortOpenTasksForCompactWidget } from '@/activities/tasks/utils/sortOpenTasksForCompactWidget';
import { WidgetHeaderCountEffect } from '@/page-layout/widgets/components/WidgetHeaderCountEffect';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { IconPlus } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  overflow: auto;
`;

const StyledHeader = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[6]};
`;

const StyledOpenCount = styled.span`
  color: ${themeCssVariables.font.color.light};
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
  const { tasks, tasksLoading, totalCountTasks } = useTasks({
    targetableObjects: [targetRecord],
  });
  const { canCreateActivity, createActivity } =
    useCreateActivityForTargetRecord({
      targetRecord,
      activityObjectNameSingular: CoreObjectNameSingular.Task,
    });
  const openTasks = sortOpenTasksForCompactWidget(tasks);

  if (tasksLoading && openTasks.length === 0) {
    return <SkeletonLoader />;
  }

  return (
    <>
      <WidgetHeaderCountEffect count={totalCountTasks} />
      {openTasks.length === 0 ? (
        <StyledEmptyContainer>
          <span>{t`No open tasks`}</span>
          {canCreateActivity && (
            <Button
              Icon={IconPlus}
              size="small"
              title={t`New task`}
              variant="secondary"
              onClick={createActivity}
            />
          )}
        </StyledEmptyContainer>
      ) : (
        <StyledContainer>
          <StyledHeader>
            <StyledOpenCount>
              {t`Open`} · {openTasks.length}
            </StyledOpenCount>
            {canCreateActivity && (
              <Button
                Icon={IconPlus}
                size="small"
                title={t`New task`}
                variant="secondary"
                onClick={createActivity}
              />
            )}
          </StyledHeader>
          <ActivityList>
            {openTasks.map((task) => (
              <TaskRow key={task.id} task={task} showTargets={false} />
            ))}
          </ActivityList>
        </StyledContainer>
      )}
    </>
  );
};
