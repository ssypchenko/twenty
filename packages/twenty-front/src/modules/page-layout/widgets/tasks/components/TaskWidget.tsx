import { CompactTasksCard } from '@/activities/tasks/components/CompactTasksCard';
import { TasksCard } from '@/activities/tasks/components/TasksCard';
import { usePageLayoutContentContext } from '@/page-layout/contexts/PageLayoutContentContext';
import { type PageLayoutWidget } from '@/page-layout/types/PageLayoutWidget';
import { isCompactActivityWidgetLayout } from '@/page-layout/widgets/utils/isCompactActivityWidgetLayout';
import { useLayoutRenderingContext } from '@/ui/layout/contexts/LayoutRenderingContext';
import { SidePanelProvider } from '@/ui/layout/side-panel/contexts/SidePanelContext';
import { styled } from '@linaria/react';

const StyledContainer = styled.div<{ isCompact: boolean }>`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: ${({ isCompact }) => (isCompact ? '360px' : 'auto')};
  overflow: ${({ isCompact }) => (isCompact ? 'hidden' : 'visible')};
  width: 100%;
`;

type TaskWidgetProps = {
  widget: PageLayoutWidget;
};

export const TaskWidget = ({ widget: _widget }: TaskWidgetProps) => {
  const { isInSidePanel } = useLayoutRenderingContext();
  const { layoutMode } = usePageLayoutContentContext();
  const isCompact = isCompactActivityWidgetLayout(layoutMode);

  return (
    <SidePanelProvider value={{ isInSidePanel }}>
      <StyledContainer isCompact={isCompact}>
        {isCompact ? <CompactTasksCard /> : <TasksCard />}
      </StyledContainer>
    </SidePanelProvider>
  );
};
