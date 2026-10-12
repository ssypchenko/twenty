import { PageLayoutType } from 'src/engine/metadata-modules/page-layout/enums/page-layout-type.enum';
import { PageLayoutException } from 'src/engine/metadata-modules/page-layout/exceptions/page-layout.exception';
import { resolvePermaventRecordOpeningTabUpdate } from 'src/engine/metadata-modules/page-layout/utils/resolve-permavent-record-opening-tab-update.util';

const pageLayout = {
  id: 'layout-1',
  workspaceId: 'workspace-1',
  type: PageLayoutType.RECORD_PAGE,
  defaultTabToFocusOnMobileAndSidePanelId: null,
  defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier: null,
};
const tab = {
  id: 'sales-tab',
  universalIdentifier: 'sales-tab-universal-identifier',
  pageLayoutId: pageLayout.id,
  workspaceId: pageLayout.workspaceId,
  deletedAt: null,
};
const resolveUpdate = (
  overrides: Partial<
    Parameters<typeof resolvePermaventRecordOpeningTabUpdate>[0]
  > = {},
) =>
  resolvePermaventRecordOpeningTabUpdate({
    pageLayout,
    requestedTabId: tab.id,
    objectNameSingular: 'company',
    isFeatureEnabled: true,
    tabs: [tab],
    receivedTabIds: [tab.id],
    ...overrides,
  });

describe('resolvePermaventRecordOpeningTabUpdate', () => {
  it.each(['company', 'branch'])(
    'sets both relation identifiers for %s',
    (objectNameSingular) => {
      expect(resolveUpdate({ objectNameSingular })).toEqual({
        defaultTabToFocusOnMobileAndSidePanelId: tab.id,
        defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier:
          tab.universalIdentifier,
      });
    },
  );

  it('preserves the current relation when an older client omits the field', () => {
    const configuredLayout = {
      ...pageLayout,
      defaultTabToFocusOnMobileAndSidePanelId: tab.id,
      defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier:
        tab.universalIdentifier,
    };

    expect(
      resolveUpdate({
        pageLayout: configuredLayout,
        requestedTabId: undefined,
      }),
    ).toEqual({
      defaultTabToFocusOnMobileAndSidePanelId: tab.id,
      defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier:
        tab.universalIdentifier,
    });
  });

  it('clears both relation identifiers when the selected tab is removed', () => {
    expect(
      resolveUpdate({
        pageLayout: {
          ...pageLayout,
          defaultTabToFocusOnMobileAndSidePanelId: tab.id,
          defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier:
            tab.universalIdentifier,
        },
        requestedTabId: null,
        tabs: [],
        receivedTabIds: [],
      }),
    ).toEqual({
      defaultTabToFocusOnMobileAndSidePanelId: null,
      defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier: null,
    });
  });

  it('allows an unchanged relation when the feature is disabled', () => {
    expect(
      resolveUpdate({ requestedTabId: null, isFeatureEnabled: false }),
    ).toEqual({
      defaultTabToFocusOnMobileAndSidePanelId: null,
      defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier: null,
    });
  });

  it.each([
    { isFeatureEnabled: false },
    { objectNameSingular: 'person' },
    { objectNameSingular: undefined },
    { pageLayout: { ...pageLayout, type: PageLayoutType.DASHBOARD } },
    { tabs: [{ ...tab, pageLayoutId: 'another-layout' }] },
    { tabs: [{ ...tab, workspaceId: 'another-workspace' }] },
    { tabs: [{ ...tab, deletedAt: '2026-01-01T00:00:00.000Z' }] },
    { tabs: [] },
    { receivedTabIds: [] },
  ])(
    'rejects an unavailable tab or an unsupported setting: %j',
    (overrides) => {
      expect(() => resolveUpdate(overrides)).toThrow(PageLayoutException);
    },
  );
});
