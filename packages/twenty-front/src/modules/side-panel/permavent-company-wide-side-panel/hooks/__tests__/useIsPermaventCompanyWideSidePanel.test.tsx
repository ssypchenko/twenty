import { renderHook } from '@testing-library/react';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';
import { SidePanelPages } from 'twenty-shared/types';

import { MAIN_CONTEXT_STORE_INSTANCE_ID } from '@/context-store/constants/MainContextStoreInstanceId';
import { contextStoreCurrentObjectMetadataItemIdComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemIdComponentState';
import { useIsPermaventCompanyWideSidePanel } from '@/side-panel/permavent-company-wide-side-panel/hooks/useIsPermaventCompanyWideSidePanel';
import { sidePanelPageInfoState } from '@/side-panel/states/sidePanelPageInfoState';
import { sidePanelPageState } from '@/side-panel/states/sidePanelPageState';

const COMPANY_METADATA_ID = 'company-metadata-id';
const SIDE_PANEL_INSTANCE_ID = 'side-panel-record-instance';

jest.mock('@/object-metadata/hooks/useObjectMetadataItems', () => ({
  useObjectMetadataItems: () => ({
    objectMetadataItems: [
      {
        id: 'company-metadata-id',
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
  it('falls back to the main context while the side panel instance is unavailable', () => {
    const store = createStore();

    store.set(sidePanelPageState.atom, SidePanelPages.ViewRecord);
    store.set(sidePanelPageInfoState.atom, {
      instanceId: '',
    });
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

  it('uses the active side panel context when its instance is available', () => {
    const store = createStore();

    store.set(sidePanelPageState.atom, SidePanelPages.ViewRecord);
    store.set(sidePanelPageInfoState.atom, {
      instanceId: SIDE_PANEL_INSTANCE_ID,
    });
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
});
