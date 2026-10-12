import { UpdatePageLayoutActionHandlerService } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/page-layout/services/update-page-layout-action-handler.service';
import { type UniversalUpdatePageLayoutAction } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/page-layout/types/workspace-migration-page-layout-action.type';
import { type WorkspaceMigrationActionRunnerArgs } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type';

const createContext = (
  update: UniversalUpdatePageLayoutAction['update'],
): WorkspaceMigrationActionRunnerArgs<UniversalUpdatePageLayoutAction> =>
  ({
    action: {
      type: 'update',
      metadataName: 'pageLayout',
      universalIdentifier: 'layout-universal-identifier',
      update,
    },
    allFlatEntityMaps: {
      flatPageLayoutMaps: {
        byUniversalIdentifier: {
          'layout-universal-identifier': { id: 'layout-id' },
        },
      },
      flatPageLayoutTabMaps: {
        byUniversalIdentifier: {
          'tab-universal-identifier': { id: 'tab-id' },
        },
      },
    },
  }) as unknown as WorkspaceMigrationActionRunnerArgs<UniversalUpdatePageLayoutAction>;

describe('UpdatePageLayoutActionHandlerService opening-tab relation', () => {
  const handler = new UpdatePageLayoutActionHandlerService();

  it('writes an explicit null to the existing database relation', async () => {
    const action = await handler.transpileUniversalActionToFlatAction(
      createContext({
        defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier: null,
      }),
    );

    expect(action.update).toEqual({
      defaultTabToFocusOnMobileAndSidePanelId: null,
    });
  });

  it('keeps the relation unchanged when the field is omitted', async () => {
    const action = await handler.transpileUniversalActionToFlatAction(
      createContext({ name: 'Company record' }),
    );

    expect(action.update).toEqual({ name: 'Company record' });
  });

  it('resolves the selected universal identifier to the tab database ID', async () => {
    const action = await handler.transpileUniversalActionToFlatAction(
      createContext({
        defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier:
          'tab-universal-identifier',
      }),
    );

    expect(action.update).toEqual({
      defaultTabToFocusOnMobileAndSidePanelId: 'tab-id',
    });
  });

  it('rejects an unresolved tab instead of saving a broken reference', async () => {
    await expect(
      handler.transpileUniversalActionToFlatAction(
        createContext({
          defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier:
            'missing-tab',
        }),
      ),
    ).rejects.toThrow('no pageLayoutTab found');
  });
});
