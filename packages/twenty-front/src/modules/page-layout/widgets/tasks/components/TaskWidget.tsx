import { CompactTasksCard } from '@/activities/tasks/components/CompactTasksCard';
import { TasksCard } from '@/activities/tasks/components/TasksCard';
import { usePageLayoutContentContext } from '@/page-layout/contexts/PageLayoutContentContext';
import { type PageLayoutWidget } from '@/page-layout/types/PageLayoutWidget';
import { WidgetContentShell } from '@/page-layout/widgets/components/WidgetContentShell';
import { isCompactActivityWidgetLayout } from '@/page-layout/widgets/utils/isCompactActivityWidgetLayout';
import { styled } from '@linaria/react';

const StyledContainer = styled.div<{ isCompact: boolean }>`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: ${({ isCompact }) => (isCompact ? '360px' : '100%')};
  overflow: ${({ isCompact }) => (isCompact ? 'hidden' : 'visible')};
  width: 100%;
`;

type TaskWidgetProps = {
  widget: PageLayoutWidget;
};

export const TaskWidget = ({ widget: _widget }: TaskWidgetProps) => {
  const { layoutMode } = usePageLayoutContentContext();
  const isCompact = isCompactActivityWidgetLayout(layoutMode);

  return (
    <WidgetContentShell>
      <StyledContainer isCompact={isCompact}>
        {isCompact ? <CompactTasksCard /> : <TasksCard />}
      </StyledContainer>
    </WidgetContentShell>
  );
};
