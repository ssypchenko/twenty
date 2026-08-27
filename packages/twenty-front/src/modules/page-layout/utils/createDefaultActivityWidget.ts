import { type PageLayoutWidget } from '@/page-layout/types/PageLayoutWidget';
import {
  PageLayoutTabLayoutMode,
  WidgetConfigurationType,
  WidgetType,
} from '~/generated-metadata/graphql';

type ActivityWidgetType = WidgetType.NOTES | WidgetType.TASKS;

const getActivityWidgetConfiguration = (type: ActivityWidgetType) =>
  type === WidgetType.NOTES
    ? {
        __typename: 'NotesConfiguration' as const,
        configurationType: WidgetConfigurationType.NOTES,
      }
    : {
        __typename: 'TasksConfiguration' as const,
        configurationType: WidgetConfigurationType.TASKS,
      };

export const createDefaultActivityWidget = ({
  id,
  pageLayoutTabId,
  title,
  type,
  positionIndex,
}: {
  id: string;
  pageLayoutTabId: string;
  title: string;
  type: ActivityWidgetType;
  positionIndex: number;
}): PageLayoutWidget => ({
  __typename: 'PageLayoutWidget',
  id,
  applicationId: '',
  universalIdentifier: id,
  isSystemSideEffect: false,
  pageLayoutTabId,
  title,
  isActive: true,
  type,
  configuration: getActivityWidgetConfiguration(type),
  gridPosition: {
    __typename: 'GridPosition',
    row: 0,
    column: 0,
    rowSpan: 1,
    columnSpan: 12,
  },
  position: {
    __typename: 'PageLayoutWidgetVerticalListPosition',
    layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
    index: positionIndex,
  },
  objectMetadataId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
});
