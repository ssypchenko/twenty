import { PERMAVENT_COMPANY_WIDE_SIDE_PANEL } from '@/side-panel/permavent-company-wide-side-panel/constants/PermaventCompanyWideSidePanel';
import { type ResizablePanelConstraints } from '@/ui/layout/resizable-panel/types/ResizablePanelConstraints';

type PermaventCompanyWideSidePanelLayout = {
  constraints: ResizablePanelConstraints;
  width: number;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export const getPermaventCompanyWideSidePanelLayout = ({
  availableWidth,
  persistedWidth,
}: {
  availableWidth: number;
  persistedWidth: number | null;
}): PermaventCompanyWideSidePanelLayout | null => {
  if (
    !Number.isFinite(availableWidth) ||
    availableWidth < PERMAVENT_COMPANY_WIDE_SIDE_PANEL.minLayoutWidth
  ) {
    return null;
  }

  const targetListWidth = clamp(
    availableWidth * PERMAVENT_COMPANY_WIDE_SIDE_PANEL.targetListRatio,
    PERMAVENT_COMPANY_WIDE_SIDE_PANEL.targetListMinWidth,
    PERMAVENT_COMPANY_WIDE_SIDE_PANEL.targetListMaxWidth,
  );

  const maximumPanelWidth =
    availableWidth - PERMAVENT_COMPANY_WIDE_SIDE_PANEL.minListWidth;

  const defaultPanelWidth = clamp(
    availableWidth - targetListWidth,
    PERMAVENT_COMPANY_WIDE_SIDE_PANEL.minPanelWidth,
    maximumPanelWidth,
  );

  const constraints = {
    min: PERMAVENT_COMPANY_WIDE_SIDE_PANEL.minPanelWidth,
    max: maximumPanelWidth,
    default: defaultPanelWidth,
  };

  return {
    constraints,
    width: clamp(
      persistedWidth ?? defaultPanelWidth,
      constraints.min,
      constraints.max,
    ),
  };
};
