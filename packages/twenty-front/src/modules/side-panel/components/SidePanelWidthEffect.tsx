import { useLayoutEffect } from 'react';

import { SIDE_PANEL_WIDTH_VAR } from '@/side-panel/states/sidePanelWidthState';

export const SidePanelWidthEffect = ({
  sidePanelWidth,
}: {
  sidePanelWidth: number;
}) => {
  useLayoutEffect(() => {
    document.documentElement.style.setProperty(
      SIDE_PANEL_WIDTH_VAR,
      `${sidePanelWidth}px`,
    );
  }, [sidePanelWidth]);

  return null;
};
