import { createDefaultActivityWidget } from '@/page-layout/utils/createDefaultActivityWidget';
import {
  PageLayoutTabLayoutMode,
  WidgetConfigurationType,
  WidgetType,
} from '~/generated-metadata/graphql';

describe('createDefaultActivityWidget', () => {
  it.each([
    { title: 'Notes', type: WidgetType.NOTES },
    { title: 'Tasks', type: WidgetType.TASKS },
  ] as const)(
    'should create a vertical-list $title widget',
    ({ title, type }) => {
      const widget = createDefaultActivityWidget({
        id: `${title.toLowerCase()}-widget-id`,
        pageLayoutTabId: 'tab-id',
        title,
        type,
        positionIndex: 2,
      });

      expect(widget).toMatchObject({
        pageLayoutTabId: 'tab-id',
        title,
        type,
        objectMetadataId: null,
        configuration: {
          configurationType: WidgetConfigurationType.FIELDS,
          viewId: null,
        },
        position: {
          layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
          index: 2,
        },
      });
    },
  );
});
