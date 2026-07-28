import { type PageLayoutWidget } from '@/page-layout/types/PageLayoutWidget';
import { WidgetType } from '~/generated-metadata/graphql';

export const canUpdateViewSettingsForWidget = (
  widget: PageLayoutWidget,
): boolean => widget.type === WidgetType.RECORD_TABLE;
