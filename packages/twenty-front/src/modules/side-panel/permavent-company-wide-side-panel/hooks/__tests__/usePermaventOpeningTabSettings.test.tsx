import { useCancelLayoutCustomization } from '@/layout-customization/hooks/useCancelLayoutCustomization';
import { activeCustomizationPageLayoutIdsState } from '@/layout-customization/states/activeCustomizationPageLayoutIdsState';
import { pageLayoutDraftComponentState } from '@/page-layout/states/pageLayoutDraftComponentState';
import { pageLayoutPersistedComponentState } from '@/page-layout/states/pageLayoutPersistedComponentState';
import { type DraftPageLayout } from '@/page-layout/types/DraftPageLayout';
import { type PageLayout } from '@/page-layout/types/PageLayout';
import { usePermaventOpeningTabSettings } from '@/side-panel/permavent-company-wide-side-panel/hooks/usePermaventOpeningTabSettings';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { act, renderHook } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { type ReactNode } from 'react';
import { PageLayoutType } from '~/generated-metadata/graphql';

let mockIsFeatureEnabled = true;
let mockObjectNameSingular = 'company';

jest.mock('@/workspace/hooks/useIsFeatureEnabled', () => ({
  useIsFeatureEnabled: () => mockIsFeatureEnabled,
}));
jest.mock('@/object-metadata/hooks/useObjectMetadataItems', () => ({
  useObjectMetadataItems: () => ({
    objectMetadataItems: [
      { id: 'object-1', nameSingular: mockObjectNameSingular },
    ],
  }),
}));
jest.mock(
  '@/layout-customization/hooks/useExitLayoutCustomizationMode',
  () => ({
    useExitLayoutCustomizationMode: () => ({
      exitLayoutCustomizationMode: jest.fn(),
    }),
  }),
);

const baseTab = {
  applicationId: 'application-1',
  pageLayoutId: 'layout-1',
  isSystemSideEffect: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const draft: DraftPageLayout = {
  id: 'layout-1',
  name: 'Company record',
  type: PageLayoutType.RECORD_PAGE,
  objectMetadataId: 'object-1',
  defaultTabToFocusOnMobileAndSidePanelId: null,
  tabs: [
    {
      ...baseTab,
      id: 'home-tab',
      title: 'Home',
      universalIdentifier: 'home',
      isActive: true,
      position: 0,
      widgets: [],
    },
    {
      ...baseTab,
      id: 'sales-tab',
      title: 'Sales History',
      universalIdentifier: '6e736654-b20d-461b-a3f4-49ed0854d267',
      isActive: true,
      position: 1,
      widgets: [],
    },
  ],
};

const draftAtom = pageLayoutDraftComponentState.atomFamily({
  instanceId: draft.id,
});
const persistedAtom = pageLayoutPersistedComponentState.atomFamily({
  instanceId: draft.id,
});

const setup = (tabId = 'home-tab', initialDraft = draft) => {
  const store = createStore();
  store.set(draftAtom, initialDraft);
  store.set(persistedAtom, initialDraft as PageLayout);
  store.set(activeCustomizationPageLayoutIdsState.atom, [draft.id]);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  const hook = renderHook(
    () => ({
      settings: usePermaventOpeningTabSettings(draft.id, tabId),
      cancel: useCancelLayoutCustomization().cancel,
    }),
    { wrapper },
  );

  return { store, ...hook };
};

describe('usePermaventOpeningTabSettings', () => {
  beforeEach(() => {
    mockIsFeatureEnabled = true;
    mockObjectNameSingular = 'company';
  });

  it('shows Sales History as the automatic opening tab', () => {
    expect(setup('sales-tab').result.current.settings?.isOpeningTab).toBe(true);
  });

  it('changes the draft without replacing the selected tab for the record', () => {
    const { store, result } = setup();
    const activeTabAtom = activeTabIdComponentState.atomFamily({
      instanceId: 'layout-1-tab-list-record-1',
    });
    store.set(activeTabAtom, 'sales-tab');

    act(() => result.current.settings?.onSetOpeningTab());

    expect(store.get(draftAtom).defaultTabToFocusOnMobileAndSidePanelId).toBe(
      'home-tab',
    );
    expect(
      store.get(persistedAtom)?.defaultTabToFocusOnMobileAndSidePanelId,
    ).toBeNull();
    expect(store.get(activeTabAtom)).toBe('sales-tab');
    expect(result.current.settings?.isOpeningTab).toBe(true);
  });

  it('restores the previous opening-tab setting when editing is cancelled', () => {
    const { store, result } = setup();
    act(() => result.current.settings?.onSetOpeningTab());
    act(() => result.current.cancel());

    expect(
      store.get(draftAtom).defaultTabToFocusOnMobileAndSidePanelId,
    ).toBeNull();
    expect(result.current.settings?.isOpeningTab).toBe(false);
  });

  it('hides the action when the feature is disabled', () => {
    mockIsFeatureEnabled = false;
    expect(setup().result.current.settings).toBeUndefined();
  });

  it('hides the action for unrelated objects', () => {
    mockObjectNameSingular = 'person';
    expect(setup().result.current.settings).toBeUndefined();
  });

  it('hides the action for a dashboard', () => {
    expect(
      setup('home-tab', { ...draft, type: PageLayoutType.DASHBOARD }).result
        .current.settings,
    ).toBeUndefined();
  });

  it('hides the action for an unavailable tab', () => {
    expect(setup('removed-tab').result.current.settings).toBeUndefined();
  });
});
