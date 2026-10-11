import { type PageLayoutTab } from '@/page-layout/types/PageLayoutTab';
import { isPermaventWideSidePanelObject } from '@/side-panel/permavent-company-wide-side-panel/utils/isPermaventWideSidePanelObject';

const SALES_TAB_UNIVERSAL_IDENTIFIER_BY_OBJECT: Record<string, string> = {
  company: '6e736654-b20d-461b-a3f4-49ed0854d267',
  branch: '7fdbdfaa-7dc5-4886-a06c-53540bb69299',
};

export const getPermaventRecordOpeningTabId = ({
  tabs,
  configuredTabId,
  objectNameSingular,
  isFeatureEnabled,
}: {
  tabs: Pick<PageLayoutTab, 'id' | 'universalIdentifier' | 'isActive'>[];
  configuredTabId?: string | null;
  objectNameSingular?: string;
  isFeatureEnabled: boolean;
}): string | undefined => {
  if (configuredTabId != null) {
    return configuredTabId;
  }

  if (
    !isFeatureEnabled ||
    !isPermaventWideSidePanelObject(objectNameSingular)
  ) {
    return undefined;
  }

  return tabs.find(
    (tab) =>
      tab.isActive &&
      tab.universalIdentifier ===
        SALES_TAB_UNIVERSAL_IDENTIFIER_BY_OBJECT[objectNameSingular!],
  )?.id;
};
