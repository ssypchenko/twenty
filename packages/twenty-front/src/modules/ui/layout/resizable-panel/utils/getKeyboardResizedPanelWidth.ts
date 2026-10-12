import { type ResizablePanelConstraints } from '@/ui/layout/resizable-panel/types/ResizablePanelConstraints';
import { type ResizablePanelSide } from '@/ui/layout/resizable-panel/types/ResizablePanelSide';

const RESIZE_STEP = 16;
const LARGE_RESIZE_STEP = 48;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export const getKeyboardResizedPanelWidth = ({
  currentWidth,
  constraints,
  key,
  shiftKey,
  side,
}: {
  currentWidth: number;
  constraints: ResizablePanelConstraints;
  key: string;
  shiftKey: boolean;
  side: ResizablePanelSide;
}) => {
  if (key === 'Home') {
    return constraints.min;
  }

  if (key === 'End') {
    return constraints.max;
  }

  if (key !== 'ArrowLeft' && key !== 'ArrowRight') {
    return null;
  }

  const pointerDirection = key === 'ArrowRight' ? 1 : -1;
  const panelDirection =
    side === 'right' ? pointerDirection : -pointerDirection;
  const step = shiftKey ? LARGE_RESIZE_STEP : RESIZE_STEP;

  return clamp(
    currentWidth + panelDirection * step,
    constraints.min,
    constraints.max,
  );
};
