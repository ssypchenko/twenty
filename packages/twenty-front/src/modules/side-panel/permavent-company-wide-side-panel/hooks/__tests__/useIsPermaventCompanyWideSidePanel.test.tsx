import { renderHook } from '@testing-library/react';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';
import { AppPath, SidePanelPages } from 'twenty-shared/types';
import { getAppPath } from 'twenty-shared/utils';
import { IconDotsVertical } from 'twenty-ui/icon';

import { MAIN_CONTEXT_STORE_INSTANCE_ID } from '@/context-store/constants/MainContextStoreInstanceId';
import { contextStoreCurrentObjectMetadataItemIdComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemIdComponentState';
import { useIsPermaventCompanyWideSidePanel } from '@/side-panel/permavent-company-wide-side-panel/hooks/useIsPermaventCompanyWideSidePanel';
import { sidePanelNavigationStackState } from '@/side-panel/states/sidePanelNavigationStackState';

const COMPANY_METADATA_ID = 'company-metadata-id';
const SIDE_PANEL_INSTANCE_ID = 'side-panel-record-instance';

const recordPath = getAppPath(AppPath.RecordShowPage, {
  objectNameSingular: 'company',
  objectRecordId: 'company-record-id',
});

const routedRecordPage = (pageId: string, pathname = recordPath) => ({
  page: SidePanelPages.RoutedPage as const,
  pageId,
  pageTitle: 'Company',
  pageIcon: IconDotsVertical,
  routedLocation: {
    pathname,
    search: '',
    hash: '',
    state: null,
    key: 'routed-company-record',
  },
});

jest.mock('@/object-metadata/hooks/useObjectMetadataItems', () => ({
  useObjectMetadataItems: () => ({
    objectMetadataItems: [
      {
        id: COMPANY_METADATA_ID,
        nameSingular: 'company',
      },
    ],
  }),
}));

jest.mock('@/workspace/hooks/useIsFeatureEnabled', () => ({
  useIsFeatureEnabled: () => true,
}));

const createWrapper = (store: ReturnType<typeof createStore>) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <JotaiProvider store={store}>{children}</JotaiProvider>;
  };

describe('useIsPermaventCompanyWideSidePanel', () => {
  it('falls back to main context when a routed panel has no instance id', () => {
    const store = createStore();

    store.set(sidePanelNavigationStackState.atom, [routedRecordPage('')]);
    store.set(
      contextStoreCurrentObjectMetadataItemIdComponentState.atomFamily({
        instanceId: MAIN_CONTEXT_STORE_INSTANCE_ID,
      }),
      COMPANY_METADATA_ID,
    );

    const { result } = renderHook(() => useIsPermaventCompanyWideSidePanel(), {
      wrapper: createWrapper(store),
    });

    expect(result.current).toBe(true);
  });

  it('uses the active routed record page context', () => {
    const store = createStore();

    store.set(sidePanelNavigationStackState.atom, [
      routedRecordPage(SIDE_PANEL_INSTANCE_ID),
    ]);
    store.set(
      contextStoreCurrentObjectMetadataItemIdComponentState.atomFamily({
        instanceId: SIDE_PANEL_INSTANCE_ID,
      }),
      COMPANY_METADATA_ID,
    );

    const { result } = renderHook(() => useIsPermaventCompanyWideSidePanel(), {
      wrapper: createWrapper(store),
    });

    expect(result.current).toBe(true);
  });

  it('does not widen an unrelated routed page', () => {
    const store = createStore();

    store.set(sidePanelNavigationStackState.atom, [
      routedRecordPage(SIDE_PANEL_INSTANCE_ID, '/settings'),
    ]);
    store.set(
      contextStoreCurrentObjectMetadataItemIdComponentState.atomFamily({
        instanceId: SIDE_PANEL_INSTANCE_ID,
      }),
      COMPANY_METADATA_ID,
    );

    const { result } = renderHook(() => useIsPermaventCompanyWideSidePanel(), {
      wrapper: createWrapper(store),
    });

    expect(result.current).toBe(false);
  });
});
