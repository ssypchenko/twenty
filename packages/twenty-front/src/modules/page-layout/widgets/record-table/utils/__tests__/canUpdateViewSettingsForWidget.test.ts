import { createDefaultFieldWidget } from '@/page-layout/utils/createDefaultFieldWidget';
import { createDefaultRecordTableWidget } from '@/page-layout/utils/createDefaultRecordTableWidget';
import { canUpdateViewSettingsForWidget } from '@/page-layout/widgets/record-table/utils/canUpdateViewSettingsForWidget';
import { FieldDisplayMode } from '~/generated-metadata/graphql';

describe('canUpdateViewSettingsForWidget', () => {
  it('should allow Record Table widgets to update view settings', () => {
    const widget = createDefaultRecordTableWidget({
      id: 'record-table-widget-id',
      pageLayoutTabId: 'tab-id',
      title: 'Opportunities',
      gridPosition: {
        row: 0,
        column: 0,
        rowSpan: 4,
        columnSpan: 12,
      },
    });

    expect(canUpdateViewSettingsForWidget(widget)).toBe(true);
  });

  it('should prevent relation Field/Table widgets from updating view settings', () => {
    const widget = createDefaultFieldWidget({
      id: 'field-table-widget-id',
      pageLayoutTabId: 'tab-id',
      title: 'Notes',
      fieldMetadataId: 'field-metadata-id',
      fieldDisplayMode: FieldDisplayMode.TABLE,
      objectMetadataId: 'object-metadata-id',
      positionIndex: 0,
    });

    expect(canUpdateViewSettingsForWidget(widget)).toBe(false);
  });
});
