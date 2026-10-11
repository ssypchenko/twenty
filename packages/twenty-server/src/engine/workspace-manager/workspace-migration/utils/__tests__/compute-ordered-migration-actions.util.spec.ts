import { createEmptyOrchestratorActionsReport } from 'src/engine/workspace-manager/workspace-migration/constant/empty-orchestrator-actions-report.constant';
import { type OrchestratorActionsReport } from 'src/engine/workspace-manager/workspace-migration/types/workspace-migration-orchestrator.type';
import { computeOrderedMigrationActions } from 'src/engine/workspace-manager/workspace-migration/utils/compute-ordered-migration-actions.util';
import { type UniversalCreatePageLayoutTabAction } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/page-layout-tab/types/workspace-migration-page-layout-tab-action.type';
import { type UniversalUpdatePageLayoutAction } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/page-layout/types/workspace-migration-page-layout-action.type';

const createTab = {
  type: 'create',
  metadataName: 'pageLayoutTab',
  flatEntity: { universalIdentifier: 'new-tab' },
} as UniversalCreatePageLayoutTabAction;

const createReport = (
  update: UniversalUpdatePageLayoutAction['update'],
): OrchestratorActionsReport => ({
  ...createEmptyOrchestratorActionsReport(),
  pageLayout: {
    create: [],
    delete: [],
    update: [
      {
        type: 'update',
        metadataName: 'pageLayout',
        universalIdentifier: 'layout',
        update,
      },
    ],
  },
  pageLayoutTab: { create: [createTab], update: [], delete: [] },
});

describe('computeOrderedMigrationActions opening-tab dependency', () => {
  it('creates a new tab before saving it as the opening tab', () => {
    const report = createReport({
      defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier: 'new-tab',
    });

    expect(computeOrderedMigrationActions(report)).toEqual([
      createTab,
      report.pageLayout.update[0],
    ]);
  });

  it.each([
    { name: 'Company record' },
    {
      defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier: 'existing-tab',
    },
    { defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier: null },
  ])(
    'preserves the original order when no new tab is referenced: %j',
    (update) => {
      const report = createReport(update);

      expect(computeOrderedMigrationActions(report)).toEqual([
        report.pageLayout.update[0],
        createTab,
      ]);
    },
  );
});
