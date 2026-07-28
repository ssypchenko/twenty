import { PageLayoutTabLayoutMode } from '~/generated-metadata/graphql';

export const isCompactActivityWidgetLayout = (
  layoutMode: PageLayoutTabLayoutMode,
): boolean => layoutMode === PageLayoutTabLayoutMode.VERTICAL_LIST;
