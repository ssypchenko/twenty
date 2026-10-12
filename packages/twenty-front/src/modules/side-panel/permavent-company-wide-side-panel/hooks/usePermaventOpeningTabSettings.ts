import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { pageLayoutDraftComponentState } from '@/page-layout/states/pageLayoutDraftComponentState';
import { PERMAVENT_COMPANY_WIDE_SIDE_PANEL_FEATURE_FLAG } from '@/side-panel/permavent-company-wide-side-panel/constants/PermaventCompanyWideSidePanelFeatureFlag';
import { type PermaventOpeningTabSettings } from '@/side-panel/permavent-company-wide-side-panel/components/PermaventOpeningTabSettingsItem';
import { getPermaventRecordOpeningTabId } from '@/side-panel/permavent-company-wide-side-panel/utils/getPermaventRecordOpeningTabId';
import { isPermaventWideSidePanelObject } from '@/side-panel/permavent-company-wide-side-panel/utils/isPermaventWideSidePanelObject';
import { useAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentState';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { PageLayoutType } from '~/generated-metadata/graphql';

export const usePermaventOpeningTabSettings = (
  pageLayoutId: string,
  tabId: string | null,
): PermaventOpeningTabSettings | undefined => {
  const isFeatureEnabled = useIsFeatureEnabled(
    PERMAVENT_COMPANY_WIDE_SIDE_PANEL_FEATURE_FLAG,
  );
  const { objectMetadataItems } = useObjectMetadataItems();
  const [pageLayoutDraft, setPageLayoutDraft] = useAtomComponentState(
    pageLayoutDraftComponentState,
    pageLayoutId,
  );
  const objectNameSingular = objectMetadataItems.find(
    (item) => item.id === pageLayoutDraft.objectMetadataId,
  )?.nameSingular;

  if (
    !isFeatureEnabled ||
    pageLayoutDraft.type !== PageLayoutType.RECORD_PAGE ||
    !isPermaventWideSidePanelObject(objectNameSingular) ||
    !pageLayoutDraft.tabs.some((tab) => tab.id === tabId && tab.isActive)
  ) {
    return undefined;
  }

  return {
    isOpeningTab:
      getPermaventRecordOpeningTabId({
        tabs: pageLayoutDraft.tabs,
        configuredTabId:
          pageLayoutDraft.defaultTabToFocusOnMobileAndSidePanelId,
        objectNameSingular,
        isFeatureEnabled,
      }) === tabId,
    onSetOpeningTab: () =>
      setPageLayoutDraft((previous) => ({
        ...previous,
        defaultTabToFocusOnMobileAndSidePanelId: tabId,
      })),
  };
};
