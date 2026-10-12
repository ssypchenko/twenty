import { useEffect } from 'react';

import {
  SIDE_PANEL_WIDTH_VAR,
  sidePanelWidthState,
} from '@/side-panel/states/sidePanelWidthState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

export const SidePanelWidthEffect = ({ sidePanelWidth: widthOverride }: { sidePanelWidth?: number } = {}) => {
  const sidePanelWidth = useAtomStateValue(sidePanelWidthState);

  const activeWidth = widthOverride ?? sidePanelWidth;

  useEffect(() => {
    document.documentElement.style.setProperty(
      SIDE_PANEL_WIDTH_VAR,
      `${activeWidth}px`,
    );
  }, [activeWidth]);

  return null;
};
