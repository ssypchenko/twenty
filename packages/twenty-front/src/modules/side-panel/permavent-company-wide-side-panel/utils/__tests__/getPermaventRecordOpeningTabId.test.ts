import { getPageLayoutTabListInitialActiveTabId } from '@/page-layout/utils/getPageLayoutTabListInitialActiveTabId';
import { type PageLayoutTab } from '@/page-layout/types/PageLayoutTab';
import { getPermaventRecordOpeningTabId } from '@/side-panel/permavent-company-wide-side-panel/utils/getPermaventRecordOpeningTabId';

const homeTab = {
  id: 'home-tab',
  universalIdentifier: 'home-universal-identifier',
  isActive: true,
} as PageLayoutTab;
const companySalesTab = {
  id: 'company-sales-tab',
  universalIdentifier: '6e736654-b20d-461b-a3f4-49ed0854d267',
  isActive: true,
} as PageLayoutTab;
const branchSalesTab = {
  id: 'branch-sales-tab',
  universalIdentifier: '7fdbdfaa-7dc5-4886-a06c-53540bb69299',
  isActive: true,
} as PageLayoutTab;

const resolveOpeningTab = (
  overrides: Partial<Parameters<typeof getPermaventRecordOpeningTabId>[0]> = {},
) =>
  getPermaventRecordOpeningTabId({
    tabs: [homeTab, companySalesTab, branchSalesTab],
    configuredTabId: null,
    objectNameSingular: 'company',
    isFeatureEnabled: true,
    ...overrides,
  });

describe('Permavent record opening tab', () => {
  it.each([
    ['company', companySalesTab.id],
    ['branch', branchSalesTab.id],
  ])(
    'opens the installed Sales History tab for %s',
    (objectNameSingular, expected) => {
      expect(resolveOpeningTab({ objectNameSingular })).toBe(expected);
    },
  );

  it('uses an explicit layout preference before the Sales History default', () => {
    expect(resolveOpeningTab({ configuredTabId: homeTab.id })).toBe(homeTab.id);
  });

  it.each(['person', 'opportunity', undefined])(
    'does not add a default for an unrelated or unknown object: %s',
    (objectNameSingular) => {
      expect(resolveOpeningTab({ objectNameSingular })).toBeUndefined();
    },
  );

  it('does not add a default when the wide-panel feature is disabled', () => {
    expect(resolveOpeningTab({ isFeatureEnabled: false })).toBeUndefined();
  });

  it('preserves the standard configured default when the extension is disabled', () => {
    expect(
      resolveOpeningTab({
        configuredTabId: homeTab.id,
        isFeatureEnabled: false,
      }),
    ).toBe(homeTab.id);
  });

  it.each([[homeTab], [homeTab, { ...companySalesTab, isActive: false }]])(
    'falls back safely when Sales History is absent or inactive',
    (...tabs) => {
      expect(resolveOpeningTab({ tabs })).toBeUndefined();
    },
  );

  it('keeps a previously selected tab ahead of the automatic Sales History default', () => {
    expect(
      getPageLayoutTabListInitialActiveTabId({
        activeTabId: homeTab.id,
        tabs: [homeTab, companySalesTab],
        defaultTabToFocusOnMobileAndSidePanelId: resolveOpeningTab(),
        isMobile: false,
        isInSidePanel: true,
      }),
    ).toBe(homeTab.id);
  });

  it.each([
    [false, true, companySalesTab.id],
    [true, false, companySalesTab.id],
    [false, false, homeTab.id],
  ])(
    'respects the existing side-panel/mobile boundary',
    (isMobile, isInSidePanel, expected) => {
      expect(
        getPageLayoutTabListInitialActiveTabId({
          activeTabId: null,
          tabs: [homeTab, companySalesTab],
          defaultTabToFocusOnMobileAndSidePanelId: resolveOpeningTab(),
          isMobile,
          isInSidePanel,
        }),
      ).toBe(expected);
    },
  );

  it('uses an available tab when a configured opening tab is hidden', () => {
    expect(
      getPageLayoutTabListInitialActiveTabId({
        activeTabId: null,
        tabs: [homeTab],
        defaultTabToFocusOnMobileAndSidePanelId: resolveOpeningTab({
          configuredTabId: companySalesTab.id,
        }),
        isMobile: false,
        isInSidePanel: true,
      }),
    ).toBe(homeTab.id);
  });
});
