import { createDefaultActivityWidget } from '@/page-layout/utils/createDefaultActivityWidget';
import {
  PageLayoutTabLayoutMode,
  WidgetConfigurationType,
  WidgetType,
} from '~/generated-metadata/graphql';

describe('createDefaultActivityWidget', () => {
  it.each([
    {
      title: 'Notes',
      type: WidgetType.NOTES,
      configurationType: WidgetConfigurationType.NOTES,
      configurationTypename: 'NotesConfiguration',
    },
    {
      title: 'Tasks',
      type: WidgetType.TASKS,
      configurationType: WidgetConfigurationType.TASKS,
      configurationTypename: 'TasksConfiguration',
    },
  ] as const)(
    'should create a server-valid vertical-list $title widget',
    ({ title, type, configurationType, configurationTypename }) => {
      const widget = createDefaultActivityWidget({
        id: `${title.toLowerCase()}-widget-id`,
        pageLayoutTabId: 'tab-id',
        title,
        type,
        positionIndex: 2,
      });

      expect(widget).toMatchObject({
        universalIdentifier: `${title.toLowerCase()}-widget-id`,
        isSystemSideEffect: false,
        pageLayoutTabId: 'tab-id',
        title,
        type,
        objectMetadataId: null,
        configuration: {
          __typename: configurationTypename,
          configurationType,
        },
        position: {
          layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
          index: 2,
        },
      });
    },
  );
});
