import { CoreObjectNameSingular } from 'twenty-shared/types';

import { type FlatPageLayoutTab } from 'src/engine/metadata-modules/flat-page-layout-tab/types/flat-page-layout-tab.type';
import { type FlatPageLayout } from 'src/engine/metadata-modules/flat-page-layout/types/flat-page-layout.type';
import { PageLayoutType } from 'src/engine/metadata-modules/page-layout/enums/page-layout-type.enum';
import {
  PageLayoutException,
  PageLayoutExceptionCode,
} from 'src/engine/metadata-modules/page-layout/exceptions/page-layout.exception';

type OpeningTabRelation = Pick<
  FlatPageLayout,
  | 'defaultTabToFocusOnMobileAndSidePanelId'
  | 'defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier'
>;

export const resolvePermaventRecordOpeningTabUpdate = ({
  pageLayout,
  requestedTabId,
  objectNameSingular,
  isFeatureEnabled,
  tabs,
  receivedTabIds,
}: {
  pageLayout: Pick<FlatPageLayout, 'id' | 'workspaceId' | 'type'> &
    OpeningTabRelation;
  requestedTabId?: string | null;
  objectNameSingular?: string;
  isFeatureEnabled: boolean;
  tabs: Pick<
    FlatPageLayoutTab,
    'id' | 'universalIdentifier' | 'pageLayoutId' | 'workspaceId' | 'deletedAt'
  >[];
  receivedTabIds: string[];
}): OpeningTabRelation => {
  const currentRelation = {
    defaultTabToFocusOnMobileAndSidePanelId:
      pageLayout.defaultTabToFocusOnMobileAndSidePanelId,
    defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier:
      pageLayout.defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier,
  };

  if (
    requestedTabId === undefined ||
    requestedTabId === currentRelation.defaultTabToFocusOnMobileAndSidePanelId
  ) {
    return currentRelation;
  }

  if (
    !isFeatureEnabled ||
    pageLayout.type !== PageLayoutType.RECORD_PAGE ||
    (objectNameSingular !== CoreObjectNameSingular.Company &&
      objectNameSingular !== 'branch')
  ) {
    throw new PageLayoutException(
      'Opening tab settings are available only for enabled Company and Branch record layouts',
      PageLayoutExceptionCode.INVALID_PAGE_LAYOUT_DATA,
    );
  }

  if (requestedTabId === null) {
    return {
      defaultTabToFocusOnMobileAndSidePanelId: null,
      defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier: null,
    };
  }

  const tab = tabs.find(
    (candidate) =>
      candidate.id === requestedTabId &&
      candidate.pageLayoutId === pageLayout.id &&
      candidate.workspaceId === pageLayout.workspaceId &&
      candidate.deletedAt === null &&
      receivedTabIds.includes(candidate.id),
  );

  if (!tab) {
    throw new PageLayoutException(
      'The opening tab must be an available tab in the same record layout',
      PageLayoutExceptionCode.INVALID_PAGE_LAYOUT_DATA,
    );
  }

  return {
    defaultTabToFocusOnMobileAndSidePanelId: tab.id,
    defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier:
      tab.universalIdentifier,
  };
};
