import { MAIN_CONTEXT_STORE_INSTANCE_ID } from '@/context-store/constants/MainContextStoreInstanceId';
import { contextStoreCurrentObjectMetadataItemIdComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemIdComponentState';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { PERMAVENT_COMPANY_WIDE_SIDE_PANEL_FEATURE_FLAG } from '@/side-panel/permavent-company-wide-side-panel/constants/PermaventCompanyWideSidePanelFeatureFlag';
import { sidePanelPageState } from '@/side-panel/states/sidePanelPageState';
import { isPermaventWideSidePanelObject } from '@/side-panel/permavent-company-wide-side-panel/utils/isPermaventWideSidePanelObject';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { SidePanelPages } from 'twenty-shared/types';

export const useIsPermaventCompanyWideSidePanel = () => {
  const isFeatureEnabled = useIsFeatureEnabled(
    PERMAVENT_COMPANY_WIDE_SIDE_PANEL_FEATURE_FLAG,
  );
  const sidePanelPage = useAtomStateValue(sidePanelPageState);
  const contextStoreCurrentObjectMetadataItemId = useAtomComponentStateValue(
    contextStoreCurrentObjectMetadataItemIdComponentState,
    MAIN_CONTEXT_STORE_INSTANCE_ID,
  );
  const { objectMetadataItems } = useObjectMetadataItems();

  const currentObjectMetadataItem = objectMetadataItems.find(
    (objectMetadataItem) =>
      objectMetadataItem.id === contextStoreCurrentObjectMetadataItemId,
  );

  return (
    isFeatureEnabled &&
    sidePanelPage === SidePanelPages.ViewRecord &&
    isPermaventWideSidePanelObject(currentObjectMetadataItem?.nameSingular)
  );
};
